const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Path to your credentials.json file
const CREDENTIALS_PATH = './credentials.json';
const TOKEN_PATH = './token.json';

async function authenticate() {
  try {
    // Load the credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    
    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    
    // Check if token already exists
    if (fs.existsSync(TOKEN_PATH)) {
      console.log('Token already exists, loading existing token...');
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    }
    
    // Generate authorization URL
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
    
    console.log('Authorize this app by visiting this url:');
    console.log(authUrl);
    
    // In a real scenario, you would get the code from the redirect
    // For this setup script, we'll simulate getting the code
    console.log('\nAfter authorizing, you will get a code. Enter it below:');
    console.log('(For automated setup, you would need to implement the redirect handling)');
    
    // For now, we'll just create a placeholder - in practice, you'd need to:
    // 1. Visit the auth URL
    // 2. Get the authorization code from the redirect
    // 3. Exchange it for tokens
    
    // Since we can't automate the browser interaction in this script,
    // we'll just provide instructions
    console.log('\nManual setup instructions:');
    console.log('1. Visit the authorization URL above');
    console.log('2. Log in and authorize the application');
    console.log('3. Copy the code from the redirect URL');
    console.log('4. Use that code to exchange for tokens');
    
    return null;
  } catch (error) {
    console.error('Error during authentication setup:', error);
    throw error;
  }
}

// Alternative function to create a dummy token file for now
function createDummyToken() {
  const dummyToken = {
    access_token: 'dummy_access_token_for_setup',
    refresh_token: 'dummy_refresh_token_for_setup',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000 // 1 hour from now
  };
  
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(dummyToken));
  console.log(`Dummy token file created at ${TOKEN_PATH}`);
  console.log('Note: You will need to replace this with a real token after proper authentication');
}

// Run the setup
async function setup() {
  console.log('Setting up Gmail API authentication...');
  
  try {
    // Try to authenticate (this will show the auth URL)
    await authenticate();
    
    // Create a dummy token file for now so the server can start
    createDummyToken();
    
    console.log('\nSetup complete!');
    console.log('Next steps:');
    console.log('1. Visit the authorization URL shown above');
    console.log('2. Authorize the application');
    console.log('3. Get the authorization code');
    console.log('4. Exchange the code for real tokens');
    console.log('5. Replace the dummy token with real tokens');
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setup();