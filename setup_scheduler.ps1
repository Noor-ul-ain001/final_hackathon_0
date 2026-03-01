# AI Employee - Windows Task Scheduler Setup Script
# This script creates a scheduled task to run the watchers at system startup

param(
    [string]$ProjectPath = "C:\Users\E\Desktop\hackathons-projects\AI_Employee",
    [string]$TaskName = "AI_Employee_Watchers",
    [switch]$Remove,
    [switch]$SetupBriefing
)

Write-Host "AI Employee - Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Warning: Running without administrator privileges." -ForegroundColor Yellow
    Write-Host "The task may not be created successfully.`n" -ForegroundColor Yellow
}

# Remove existing task if -Remove flag is set
if ($Remove) {
    Write-Host "Removing existing task: $TaskName" -ForegroundColor Yellow
    schtasks /delete /tn $TaskName /f 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Task removed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Task not found or could not be removed." -ForegroundColor Yellow
    }
    exit
}

# Verify project path exists
if (-not (Test-Path $ProjectPath)) {
    Write-Host "Error: Project path not found: $ProjectPath" -ForegroundColor Red
    Write-Host "Please specify the correct path with -ProjectPath parameter" -ForegroundColor Red
    exit 1
}

# Verify start_watchers.py exists
$watcherScript = Join-Path $ProjectPath "start_watchers.py"
if (-not (Test-Path $watcherScript)) {
    Write-Host "Error: start_watchers.py not found at: $watcherScript" -ForegroundColor Red
    exit 1
}

Write-Host "Project path: $ProjectPath" -ForegroundColor White
Write-Host "Task name: $TaskName`n" -ForegroundColor White

# Create XML task definition
$xmlPath = Join-Path $ProjectPath "watcher_task.xml"
$pythonPath = (Get-Command python).Path

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>AI Employee Watcher Services - Monitors Gmail, LinkedIn, and File System</Description>
    <Author>$env:USERNAME</Author>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT1M</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$pythonPath</Command>
      <Arguments>start_watchers.py</Arguments>
      <WorkingDirectory>$ProjectPath</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

# Save XML to file
Write-Host "Creating task definition file..." -ForegroundColor White
$xml | Out-File -FilePath $xmlPath -Encoding UTF8

# Remove any existing task with the same name
Write-Host "Removing any existing task with the same name..." -ForegroundColor White
schtasks /delete /tn $TaskName /f 2>$null | Out-Null

# Create the scheduled task
Write-Host "Creating scheduled task..." -ForegroundColor White
schtasks /create /tn $TaskName /xml $xmlPath /f

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Success! Scheduled task created." -ForegroundColor Green
    Write-Host "`nTask Details:" -ForegroundColor Cyan
    Write-Host "  Name: $TaskName" -ForegroundColor White
    Write-Host "  Trigger: At user logon (delayed 1 minute)" -ForegroundColor White
    Write-Host "  Action: Run Python watchers" -ForegroundColor White
    Write-Host "  Working Directory: $ProjectPath" -ForegroundColor White

    Write-Host "`nManage Your Task:" -ForegroundColor Cyan
    Write-Host "  View in Task Scheduler: " -NoNewline -ForegroundColor White
    Write-Host "taskschd.msc" -ForegroundColor Yellow
    Write-Host "  Run manually: " -NoNewline -ForegroundColor White
    Write-Host "schtasks /run /tn $TaskName" -ForegroundColor Yellow
    Write-Host "  Disable: " -NoNewline -ForegroundColor White
    Write-Host "schtasks /change /tn $TaskName /disable" -ForegroundColor Yellow
    Write-Host "  Enable: " -NoNewline -ForegroundColor White
    Write-Host "schtasks /change /tn $TaskName /enable" -ForegroundColor Yellow
    Write-Host "  Remove: " -NoNewline -ForegroundColor White
    Write-Host ".\setup_scheduler.ps1 -Remove" -ForegroundColor Yellow

    Write-Host "`nNext Steps:" -ForegroundColor Cyan
    Write-Host "  1. Review the task in Task Scheduler GUI" -ForegroundColor White
    Write-Host "  2. Test run: schtasks /run /tn $TaskName" -ForegroundColor White
    Write-Host "  3. Check logs in: $ProjectPath\logs" -ForegroundColor White
    Write-Host "  4. The watchers will start automatically at next logon" -ForegroundColor White

} else {
    Write-Host "`n❌ Error: Failed to create scheduled task." -ForegroundColor Red
    Write-Host "Try running this script as Administrator." -ForegroundColor Yellow
    exit 1
}

# Clean up XML file
Remove-Item $xmlPath -ErrorAction SilentlyContinue

# Set up CEO Briefing scheduled task (Sunday 8 PM)
if ($SetupBriefing) {
    Write-Host "`n`nSetting up CEO Briefing Scheduler..." -ForegroundColor Cyan
    Write-Host "====================================`n" -ForegroundColor Cyan

    $briefingTaskName = "AI_Employee_CEO_Briefing"
    $briefingScript = Join-Path $ProjectPath "ceo_briefing_generator.py"

    if (-not (Test-Path $briefingScript)) {
        Write-Host "Warning: ceo_briefing_generator.py not found" -ForegroundColor Yellow
    } else {
        # Remove existing CEO briefing task
        schtasks /delete /tn $briefingTaskName /f 2>$null | Out-Null

        # Create CEO Briefing task (runs every Sunday at 8 PM)
        schtasks /create /tn $briefingTaskName /sc weekly /d SUN /st 20:00 /tr "python $briefingScript" /ru "$env:USERNAME" /f

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ CEO Briefing task created!" -ForegroundColor Green
            Write-Host "  Schedule: Every Sunday at 8:00 PM" -ForegroundColor White
            Write-Host "  Run manually: schtasks /run /tn $briefingTaskName" -ForegroundColor Yellow
        } else {
            Write-Host "❌ Failed to create CEO Briefing task" -ForegroundColor Red
        }
    }
}

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
