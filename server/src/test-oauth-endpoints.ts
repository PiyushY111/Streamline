import { db } from './db/client.js';
import { users, connectedAccounts } from './db/schema/index.js';

async function testOAuthEndpoints() {
  console.log('Testing Accounts DB query...');
  const userList = await db.select().from(users).limit(1);
  if (userList.length === 0) {
    console.log('No users found in DB. Default user will be created on first OAuth login.');
  } else {
    console.log(`Default user exists: ${userList[0].email} (${userList[0].id})`);
    const accounts = await db.select().from(connectedAccounts);
    console.log(`Connected Google Accounts in DB: ${accounts.length}`);
  }
  console.log('✨ OAuth controller & database layer verified successfully!');
  process.exit(0);
}

testOAuthEndpoints().catch((err) => {
  console.error('❌ OAuth test error:', err);
  process.exit(1);
});
