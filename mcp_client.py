#!/usr/bin/env python3
"""
MCP Client - Model Context Protocol Client
-------------------------------------------
Python client for communicating with MCP servers.

Per Hackathon Document:
"MCP servers are Claude Code's hands for interacting with external systems.
Each MCP server exposes specific capabilities that Claude can invoke."

This client enables Python scripts (like Ralph Wiggum Loop) to call
MCP server tools directly without going through Claude Code.

Supported MCP Servers:
- email-mcp: Gmail operations (send, draft, search)
- odoo-mcp: Accounting operations (invoices, expenses, reports)
- twitter-mcp: Twitter API v2 operations
- linkedin-mcp: LinkedIn posting
- social-mcp: Multi-platform social media
"""

import os
import json
import subprocess
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('MCPClient')


class MCPError(Exception):
    """Base exception for MCP errors."""
    pass


class MCPConnectionError(MCPError):
    """Failed to connect to MCP server."""
    pass


class MCPToolError(MCPError):
    """Tool execution failed."""
    pass


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""
    name: str
    command: str
    args: List[str]
    env: Dict[str, str]


@dataclass
class MCPToolResult:
    """Result from an MCP tool call."""
    success: bool
    data: Any
    error: Optional[str] = None
    server: Optional[str] = None
    tool: Optional[str] = None


class MCPClient:
    """
    Client for calling MCP server tools.

    Supports two modes:
    1. Subprocess mode: Spawns MCP server, calls tool, gets result
    2. Stdio mode: Communicates via stdin/stdout JSON-RPC

    Per hackathon doc, this enables:
    - Email MCP: Send emails, search inbox
    - Odoo MCP: Create invoices, record expenses
    - Twitter MCP: Post tweets, get engagement
    """

    def __init__(self, config_path: str = None):
        """
        Initialize MCP client.

        Args:
            config_path: Path to mcp.json configuration file
        """
        self.config_path = Path(config_path) if config_path else Path(__file__).parent / 'mcp.json'
        self.servers: Dict[str, MCPServerConfig] = {}
        self.dry_run = os.getenv('DRY_RUN', 'false').lower() == 'true'

        self._load_config()

    def _load_config(self):
        """Load MCP server configuration."""
        if not self.config_path.exists():
            logger.warning(f'MCP config not found: {self.config_path}')
            return

        try:
            config = json.loads(self.config_path.read_text())

            for server_config in config.get('servers', []):
                name = server_config.get('name')
                if name:
                    self.servers[name] = MCPServerConfig(
                        name=name,
                        command=server_config.get('command', 'node'),
                        args=server_config.get('args', []),
                        env=server_config.get('env', {})
                    )

            logger.info(f'Loaded {len(self.servers)} MCP server configurations')

        except Exception as e:
            logger.error(f'Failed to load MCP config: {e}')

    def get_server(self, name: str) -> Optional[MCPServerConfig]:
        """Get server configuration by name."""
        return self.servers.get(name)

    def list_servers(self) -> List[str]:
        """List available MCP servers."""
        return list(self.servers.keys())

    async def call_tool_async(
        self,
        server_name: str,
        tool_name: str,
        arguments: Dict = None,
        timeout: int = 30
    ) -> MCPToolResult:
        """
        Call an MCP tool asynchronously.

        Args:
            server_name: Name of the MCP server
            tool_name: Name of the tool to call
            arguments: Tool arguments
            timeout: Timeout in seconds

        Returns:
            MCPToolResult with success status and data
        """
        if self.dry_run:
            logger.info(f'[DRY RUN] Would call {server_name}.{tool_name}')
            return MCPToolResult(
                success=True,
                data={'dry_run': True, 'tool': tool_name, 'arguments': arguments},
                server=server_name,
                tool=tool_name
            )

        server = self.get_server(server_name)
        if not server:
            return MCPToolResult(
                success=False,
                data=None,
                error=f'Server not found: {server_name}',
                server=server_name,
                tool=tool_name
            )

        try:
            # Build JSON-RPC request
            request = {
                'jsonrpc': '2.0',
                'id': 1,
                'method': 'tools/call',
                'params': {
                    'name': tool_name,
                    'arguments': arguments or {}
                }
            }

            # Create environment with server-specific vars
            env = os.environ.copy()
            env.update(server.env)

            # Build command
            cmd = [server.command] + server.args

            # Run server with JSON-RPC input
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )

            # Send request
            stdin_data = json.dumps(request).encode() + b'\n'
            stdout, stderr = await asyncio.wait_for(
                process.communicate(stdin_data),
                timeout=timeout
            )

            # Parse response
            if stdout:
                try:
                    response = json.loads(stdout.decode())
                    if 'error' in response:
                        return MCPToolResult(
                            success=False,
                            data=None,
                            error=response['error'].get('message', 'Unknown error'),
                            server=server_name,
                            tool=tool_name
                        )
                    return MCPToolResult(
                        success=True,
                        data=response.get('result'),
                        server=server_name,
                        tool=tool_name
                    )
                except json.JSONDecodeError:
                    # Non-JSON response, treat as raw result
                    return MCPToolResult(
                        success=True,
                        data={'raw_output': stdout.decode()},
                        server=server_name,
                        tool=tool_name
                    )

            if stderr:
                return MCPToolResult(
                    success=False,
                    data=None,
                    error=stderr.decode(),
                    server=server_name,
                    tool=tool_name
                )

            return MCPToolResult(
                success=False,
                data=None,
                error='No response from MCP server',
                server=server_name,
                tool=tool_name
            )

        except asyncio.TimeoutError:
            return MCPToolResult(
                success=False,
                data=None,
                error=f'Timeout after {timeout}s',
                server=server_name,
                tool=tool_name
            )
        except Exception as e:
            return MCPToolResult(
                success=False,
                data=None,
                error=str(e),
                server=server_name,
                tool=tool_name
            )

    def call_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: Dict = None,
        timeout: int = 30
    ) -> MCPToolResult:
        """
        Call an MCP tool synchronously.

        This is a convenience wrapper around call_tool_async for
        non-async code (like Ralph Wiggum Loop).
        """
        return asyncio.run(self.call_tool_async(
            server_name, tool_name, arguments, timeout
        ))

    # ==================== Convenience Methods ====================

    # Email MCP
    def send_email(self, to: str, subject: str, body: str, attachments: List[str] = None) -> MCPToolResult:
        """Send email via email-mcp."""
        return self.call_tool('email', 'gmail_send_email', {
            'to': to,
            'subject': subject,
            'body': body,
            'attachments': attachments or []
        })

    def draft_email(self, to: str, subject: str, body: str) -> MCPToolResult:
        """Create email draft via email-mcp."""
        return self.call_tool('email', 'gmail_create_draft', {
            'to': to,
            'subject': subject,
            'body': body
        })

    def search_emails(self, query: str, max_results: int = 10) -> MCPToolResult:
        """Search emails via email-mcp."""
        return self.call_tool('email', 'gmail_search', {
            'query': query,
            'max_results': max_results
        })

    # Odoo MCP
    def create_invoice(self, partner: str, lines: List[Dict], **kwargs) -> MCPToolResult:
        """Create invoice via odoo-mcp."""
        return self.call_tool('odoo', 'odoo_create_invoice', {
            'partner_name': partner,
            'invoice_lines': lines,
            **kwargs
        })

    def get_revenue_report(self, start_date: str, end_date: str) -> MCPToolResult:
        """Get revenue report via odoo-mcp."""
        return self.call_tool('odoo', 'odoo_get_revenue_report', {
            'start_date': start_date,
            'end_date': end_date
        })

    def get_expense_report(self, start_date: str, end_date: str) -> MCPToolResult:
        """Get expense report via odoo-mcp."""
        return self.call_tool('odoo', 'odoo_get_expense_report', {
            'start_date': start_date,
            'end_date': end_date
        })

    def get_unpaid_invoices(self) -> MCPToolResult:
        """Get unpaid invoices via odoo-mcp."""
        return self.call_tool('odoo', 'odoo_get_unpaid_invoices', {})

    def get_aging_report(self) -> MCPToolResult:
        """Get accounts receivable aging via odoo-mcp."""
        return self.call_tool('odoo', 'odoo_get_aging_report', {})

    def create_expense(self, description: str, amount: float, category: str = 'General') -> MCPToolResult:
        """Create expense via odoo-mcp."""
        return self.call_tool('odoo', 'odoo_create_expense', {
            'description': description,
            'amount': amount,
            'category': category
        })

    # Twitter MCP
    def post_tweet(self, text: str) -> MCPToolResult:
        """Post tweet via twitter-mcp."""
        return self.call_tool('twitter', 'twitter_post_tweet', {
            'text': text
        })

    def get_twitter_summary(self, days: int = 7) -> MCPToolResult:
        """Get Twitter engagement summary via twitter-mcp."""
        return self.call_tool('twitter', 'twitter_get_weekly_summary', {
            'days': days
        })

    def get_twitter_mentions(self) -> MCPToolResult:
        """Get Twitter mentions via twitter-mcp."""
        return self.call_tool('twitter', 'twitter_get_mentions', {})

    # LinkedIn MCP
    def post_linkedin(self, content: str, hashtags: List[str] = None, visibility: str = 'PUBLIC') -> MCPToolResult:
        """Post to LinkedIn via linkedin-mcp."""
        return self.call_tool('linkedin', 'linkedin_create_post', {
            'content': content,
            'hashtags': hashtags or [],
            'visibility': visibility
        })

    # Social MCP (Multi-platform)
    def post_social(self, platform: str, content: str) -> MCPToolResult:
        """Post to any social platform via social-mcp."""
        return self.call_tool('social', f'{platform}_post', {
            'content': content
        })


# Global client instance
_mcp_client: Optional[MCPClient] = None


def get_mcp_client(config_path: str = None) -> MCPClient:
    """Get or create the global MCP client."""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPClient(config_path)
    return _mcp_client


# CLI for testing
def main():
    """Test MCP client from command line."""
    import argparse

    parser = argparse.ArgumentParser(description='MCP Client CLI')
    parser.add_argument('--server', required=True, help='MCP server name')
    parser.add_argument('--tool', required=True, help='Tool to call')
    parser.add_argument('--args', type=str, default='{}', help='JSON arguments')
    parser.add_argument('--config', help='Path to mcp.json')
    parser.add_argument('--list', action='store_true', help='List available servers')

    args = parser.parse_args()

    client = MCPClient(args.config)

    if args.list:
        print("Available MCP servers:")
        for name in client.list_servers():
            server = client.get_server(name)
            print(f"  - {name}: {server.command} {' '.join(server.args)}")
        return

    try:
        tool_args = json.loads(args.args)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON arguments: {e}")
        return

    print(f"Calling {args.server}.{args.tool}...")
    result = client.call_tool(args.server, args.tool, tool_args)

    print(f"\nResult:")
    print(f"  Success: {result.success}")
    if result.error:
        print(f"  Error: {result.error}")
    if result.data:
        print(f"  Data: {json.dumps(result.data, indent=2)}")


if __name__ == '__main__':
    main()
