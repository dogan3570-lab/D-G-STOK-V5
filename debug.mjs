// Debug script to catch errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:');
  console.error(err);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:');
  console.error('Reason:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  process.exit(1);
});

console.log('Starting server...');
import('./apps/server/src/index.ts').then(() => {
  console.log('Server module loaded');
}).catch(err => {
  console.error('Import error:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});
