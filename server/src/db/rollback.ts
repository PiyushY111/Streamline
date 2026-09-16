import { neon } from '@neondatabase/serverless';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export interface RollbackOptions {
  dryRun?: boolean;
  targetFile?: string;
}

export async function rollbackLastMigration(options: RollbackOptions = {}): Promise<{ executedFiles: string[]; totalStatements: number; dryRun: boolean }> {
  const dryRun = Boolean(options.dryRun);
  logger.info({ dryRun }, '🔄 Initiating database down-migration rollback process...');

  const rollbackFolder = path.resolve(process.cwd(), 'drizzle/rollback');
  if (!fs.existsSync(rollbackFolder)) {
    throw new Error(`Rollback folder does not exist: ${rollbackFolder}`);
  }

  const files = fs
    .readdirSync(rollbackFolder)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse();

  if (files.length === 0) {
    logger.info('ℹ️ No rollback SQL files found in drizzle/rollback directory.');
    return { executedFiles: [], totalStatements: 0, dryRun };
  }

  const targetFiles = options.targetFile ? [options.targetFile] : [files[0]];
  let totalStatements = 0;
  const executedFiles: string[] = [];

  const sql = neon(env.DATABASE_URL);

  for (const filename of targetFiles) {
    const filePath = path.join(rollbackFolder, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Specified rollback file not found: ${filePath}`);
    }

    const rawSql = fs.readFileSync(filePath, 'utf-8');
    const statements = rawSql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    logger.info({ file: filename, statementCount: statements.length }, 'Found down-migration file');

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (dryRun) {
        logger.info({ step: i + 1, statement: stmt }, '🔍 [DRY-RUN] Would execute rollback statement:');
      } else {
        logger.info({ step: i + 1, statement: stmt }, '⚙️ Executing rollback statement...');
        await sql(stmt);
      }
      totalStatements++;
    }

    executedFiles.push(filename);
  }

  if (dryRun) {
    logger.info({ totalStatements, executedFiles }, '✅ [DRY-RUN] Rollback preview completed successfully with no changes applied.');
  } else {
    logger.info({ totalStatements, executedFiles }, '🎉 Database rollback completed successfully!');
  }

  return { executedFiles, totalStatements, dryRun };
}

// CLI entry point
if (process.argv[1]?.endsWith('rollback.ts') || process.argv[1]?.endsWith('rollback.js')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetFileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];

  rollbackLastMigration({ dryRun, targetFile: targetFileArg })
    .then((res) => {
      logger.info(res, 'Rollback runner finished cleanly');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Fatal error during database rollback');
      process.exit(1);
    });
}
