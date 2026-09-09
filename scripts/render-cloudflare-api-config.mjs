import { writeFileSync } from 'node:fs';

const outputPath = process.argv[2] ?? 'apps/api-worker/wrangler.generated.json';
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? '00000000-0000-0000-0000-000000000000';
const databaseName = process.env.BEEECOM_D1_DATABASE_NAME ?? 'beeecom-demo';
const workerName = process.env.BEEECOM_API_WORKER_NAME ?? 'beeecom-api-preview';
const corsOrigins = process.env.BEEECOM_CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174';
const defaultScenario = process.env.BEEECOM_DEFAULT_SCENARIO ?? 'healthy';

const config = {
  $schema: './node_modules/wrangler/config-schema.json',
  name: workerName,
  main: 'src/entry.ts',
  compatibility_date: '2026-09-09',
  d1_databases: [
    {
      binding: 'DB',
      database_name: databaseName,
      database_id: databaseId,
      migrations_dir: 'migrations',
    },
  ],
  durable_objects: {
    bindings: [
      {
        name: 'CHAT_ROOMS',
        class_name: 'ChatRoom',
      },
    ],
  },
  exports: {
    ChatRoom: {
      type: 'durable-object',
      storage: 'sqlite',
    },
  },
  vars: {
    DEFAULT_SCENARIO: defaultScenario,
    CORS_ORIGINS: corsOrigins,
  },
  secrets: {
    required: ['DEMO_RESET_TOKEN'],
  },
};

writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Rendered ${outputPath} for Worker ${workerName}.`);
