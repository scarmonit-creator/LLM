import { JulesClient } from './jules-client.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const jules = new JulesClient();

  console.log('🤖 Jules API Integration Demo\n');

  try {
    // 1. List available sources
    console.log('📂 Listing sources...');
    const sources = await jules.listSources();
    if (sources.success) {
      console.log(`✓ Found ${sources.data.sources?.length || 0} sources`);
      sources.data.sources?.forEach((source) => {
        console.log(`  - ${source.name}`);
      });
    } else {
      console.error(`✗ Error: ${sources.error}`);
    }

    console.log();

    // 2. List existing sessions
    console.log('📋 Listing sessions...');
    const sessions = await jules.listSessions({ pageSize: 5 });
    if (sessions.success) {
      const sessionList = sessions.data.sessions || [];
      console.log(`✓ Found ${sessionList.length} sessions`);
      sessionList.forEach((session) => {
        console.log(`  - ${session.id} (${session.state})`);
        console.log(`    ${session.title.substring(0, 80)}...`);
      });
    } else {
      console.error(`✗ Error: ${sessions.error}`);
    }

    console.log();

    // 3. Create a new session (optional - commented out to avoid creating sessions on every run)
    // console.log('🆕 Creating new session...');
    // const newSession = await jules.createSession({
    //   prompt: 'Analyze the LLM repository structure and suggest improvements',
    //   title: 'Repository Analysis Session'
    // });
    // if (newSession.success) {
    //   console.log(`✓ Session created: ${newSession.sessionId}`);
    // } else {
    //   console.error(`✗ Error: ${newSession.error}`);
    // }

    console.log('✅ Jules API integration verified successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
