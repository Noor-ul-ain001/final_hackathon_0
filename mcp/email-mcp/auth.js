const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

// Path to your credentials.json file
const CREDENTIALS_PATH = './credentials.json';
const TOKEN_PATH = './token.json';

// Scopes required for the email MCP server
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

async function authenticateAndSaveToken() {
  try {
    // Load the credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

    const { client_secret, client_id, redirect_uris } = credentials.installed;

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0] // Using the first redirect URI
    );

    // Check if token already exists
    if (fs.existsSync(TOKEN_PATH)) {
      console.log('Token already exists, loading existing token...');
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    }

    // Generate authorization URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline', // This ensures we get a refresh token
      scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:');
    console.log(authUrl);
    console.log('');
    console.log('⚠️  IMPORTANT NOTICE:');
    console.log('- This app is in TESTING mode and not verified by Google');
    console.log('- You may see a warning screen saying "unverified app"');
    console.log('- This is NORMAL for testing applications');
    console.log('- If you get an "access_denied" error, make sure your email has been added as a TEST USER');
    console.log('- See docs/ADDING_TEST_USERS.md for instructions on adding test users');
    console.log('');

    // Start a simple HTTP server to receive the authorization code
    console.log('Starting local server to receive authorization code...');
    console.log('After authorizing, you will be redirected to http://localhost:3000');
    console.log('The local server will capture the authorization code automatically.');
    console.log('');

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.query.code) {
          // Got the authorization code
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(`
            <h1>✅ Authorization Successful!</h1>
            <p>Your Gmail access has been authorized.</p>
            <p>You can close this window and return to the terminal.</p>
            <p><small>If you encountered issues, check that your email was added as a test user in Google Cloud Console.</small></p>
          `);

          try {
            // Exchange the code for tokens
            const { tokens } = await oAuth2Client.getToken(parsedUrl.query.code);

            // Save the tokens to the token file
            oAuth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

            console.log('✅ Token stored to', TOKEN_PATH);

            // Close the server
            server.close(() => {
              console.log('Authentication server closed.');
              resolve(oAuth2Client);
            });
          } catch (error) {
            console.error('❌ Error retrieving access token:', error.message);
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end(`
              <h1>❌ Error</h1>
              <p>There was an error retrieving the access token:</p>
              <p>${error.message}</p>
              <p><small>Possible causes:<br>
              - Invalid authorization code<br>
              - Your email is not added as a test user<br>
              - Check docs/ADDING_TEST_USERS.md for instructions</small></p>
            `);
            reject(error);
          }
        } else {
          res.writeHead(404, {'Content-Type': 'text/plain'});
          res.end('Not Found');
        }
      });

      server.listen(3000, () => {
        console.log('✅ Server listening on http://localhost:3000');
        console.log('Please visit the authorization URL in your browser...');
        console.log('');
        console.log('💡 TIP: If authentication fails, make sure to:');
        console.log('   1. Add your email as a test user in Google Cloud Console');
        console.log('   2. Wait a few minutes for Google to propagate the changes');
        console.log('   3. Clear your browser cache/cookies before retrying');
        console.log('');
      });
    });
  } catch (error) {
    console.error('❌ Error during authentication:', error.message);
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('- Make sure your email is added as a test user in Google Cloud Console');
    console.log('- Check docs/OAUTH_CONSENT_SETUP.md for detailed setup instructions');
    console.log('- Verify your credentials.json file is properly configured');
    throw error;
  }
}

// Main function
async function main() {
  console.log('Starting Gmail API authentication setup...');
  
  try {
    const auth = await authenticateAndSaveToken();
    console.log('Authentication successful! Token saved to token.json');
    console.log('You can now start the email MCP server.');
  } catch (error) {
    console.error('Authentication failed:', error);
    process.exit(1);
  }
}

// Run the authentication
main();