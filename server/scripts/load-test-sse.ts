import { EventEmitter } from 'events';
import { sseService } from '../src/services/sse.service.js';

interface MemorySnapshot {
  heapUsedMb: number;
  rssMb: number;
  activeClients: number;
}

class MockSSEResponse extends EventEmitter {
  public headers: Record<string, string | string[]> = {};
  public statusCode: number = 200;
  public writtenData: string[] = [];
  public closed: boolean = false;

  writeHead(status: number, headers: Record<string, string | string[]>) {
    this.statusCode = status;
    this.headers = headers;
    return this;
  }

  write(chunk: string) {
    if (!this.closed) {
      this.writtenData.push(chunk);
    }
    return true;
  }

  end() {
    this.close();
    return this;
  }

  close() {
    if (!this.closed) {
      this.closed = true;
      this.emit('close');
    }
  }
}

function getMemory(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
    rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    activeClients: sseService.getClientCount(),
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSseSoakTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⚡ Streamline SSE Connection Soak & Memory Leak Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  const TOTAL_CONNECTIONS = 500;
  const BATCH_SIZE = 50;
  const BATCHES = TOTAL_CONNECTIONS / BATCH_SIZE;

  // 1. Measure initial baseline
  if (global.gc) {
    global.gc();
  }
  await sleep(100);
  const baseline = getMemory();
  console.log(
    `📊 [Baseline] Heap: ${baseline.heapUsedMb} MB | RSS: ${baseline.rssMb} MB | Active Clients: ${baseline.activeClients}`,
  );

  const activeSockets: MockSSEResponse[] = [];

  // 2. Open 500 connections across 10 batches
  console.log(`\n🚀 Opening ${TOTAL_CONNECTIONS} rapid SSE streams across ${BATCHES} concurrent batches...`);

  for (let batch = 0; batch < BATCHES; batch++) {
    const batchSockets: MockSSEResponse[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const socket = new MockSSEResponse();
      const userId = `soak-user-${batch * BATCH_SIZE + i}`;
      sseService.addClient(userId, socket as any);
      batchSockets.push(socket);
      activeSockets.push(socket);
    }

    // Broadcast test events to simulate active traffic
    sseService.broadcast('agent.heartbeat', { batch, timestamp: Date.now() });

    const current = getMemory();
    console.log(
      `  Batch ${batch + 1}/${BATCHES} (+${BATCH_SIZE}) -> Total: ${activeSockets.length} | Heap: ${current.heapUsedMb} MB`,
    );
    await sleep(20);
  }

  const peakMemory = getMemory();
  console.log(
    `\n🔥 [Peak Load] Heap: ${peakMemory.heapUsedMb} MB | RSS: ${peakMemory.rssMb} MB | Active Clients: ${peakMemory.activeClients}`,
  );

  // 3. Emit high-frequency targeted events to users
  console.log('\n📡 Dispatching 100 targeted user events...');
  for (let i = 0; i < 100; i++) {
    const targetUserId = `soak-user-${i}`;
    sseService.emitToUser(targetUserId, 'email.received', {
      emailId: `email-${i}`,
      subject: `Soak test message ${i}`,
    });
  }

  // 4. Close all 500 connections
  console.log(`\n🛑 Disconnecting all ${TOTAL_CONNECTIONS} SSE client streams...`);
  for (const socket of activeSockets) {
    socket.close();
  }
  activeSockets.length = 0;

  // 5. Allow event loop & GC to settle
  await sleep(500);
  if (global.gc) {
    global.gc();
  }
  await sleep(200);

  const postCleanup = getMemory();
  console.log(
    `📊 [Post-Cleanup] Heap: ${postCleanup.heapUsedMb} MB | RSS: ${postCleanup.rssMb} MB | Active Clients: ${postCleanup.activeClients}`,
  );

  // 6. Verification assertions
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('📋 Soak Test Verification Results:');
  console.log('───────────────────────────────────────────────────────────');

  const clientsCleaned = postCleanup.activeClients === 0;
  console.log(
    `  ✓ Active Clients Count: ${postCleanup.activeClients} (Expected: 0) -> ${clientsCleaned ? 'PASS' : 'FAIL'}`,
  );

  const heapGrowthMb = postCleanup.heapUsedMb - baseline.heapUsedMb;
  const heapGrowthPct = (heapGrowthMb / Math.max(baseline.heapUsedMb, 1)) * 100;
  console.log(`  ✓ Heap Growth: ${heapGrowthMb.toFixed(2)} MB (${heapGrowthPct.toFixed(1)}%) (Max Tolerance: 15%)`);

  const memorySafe = heapGrowthPct < 15.0;

  if (clientsCleaned && memorySafe) {
    console.log('\n✅ [PASS] SSE soak test completed successfully. Zero connection leaks detected.\n');
    process.exit(0);
  } else {
    console.error('\n❌ [FAIL] SSE soak test failed: memory or connection leaks detected.\n');
    process.exit(1);
  }
}

runSseSoakTest().catch((err) => {
  console.error('Fatal error during SSE soak test:', err);
  process.exit(1);
});
