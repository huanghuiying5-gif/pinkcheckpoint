import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  ReadingPassageRecord,
  ReadingPassageRow,
} from "../domain/readingPassage.js";
import { runMigrations } from "./migrations.js";

export const DEFAULT_READING_PASSAGE =
  "Welcome to Shangrao, a beautiful city surrounded by green mountains and clear rivers. Near Poyang Lake, people enjoy peaceful views, fresh air, and many local traditions. The city is also known for delicious rice noodles and special Shangrao chicken legs. As you read, notice the rhythm of each sentence, pause naturally at punctuation, and let every word carry the story. Today, let’s explore this charming place and share its beauty with the world.";

function toRecord(row: ReadingPassageRow): ReadingPassageRecord {
  return {
    id: "current_reading_passage",
    content: row.content,
    revision: row.revision,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
  };
}

export class ReadingPassageStore {
  readonly database: DatabaseSync;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      const absolutePath = resolve(databasePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      this.database = new DatabaseSync(absolutePath);
    } else {
      this.database = new DatabaseSync(":memory:");
    }

    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
    if (databasePath !== ":memory:") {
      this.database.exec("PRAGMA journal_mode = WAL");
    }

    runMigrations(this.database);
    this.seedFirstRunPassage();
  }

  private seedFirstRunPassage(): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO current_reading_passage
          (id, content, revision, updated_at)
         VALUES (1, ?, 1, ?)`,
      )
      .run(DEFAULT_READING_PASSAGE, new Date().toISOString());
  }

  getCurrent(): ReadingPassageRecord {
    const row = this.database
      .prepare(
        `SELECT id, content, revision, updated_at
         FROM current_reading_passage
         WHERE id = 1`,
      )
      .get() as ReadingPassageRow | undefined;

    if (!row) {
      throw new Error("The current reading passage has not been initialized.");
    }

    return toRecord(row);
  }

  replaceCurrent(content: string): ReadingPassageRecord {
    const updatedAt = new Date().toISOString();

    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `UPDATE current_reading_passage
           SET content = ?, revision = revision + 1, updated_at = ?
           WHERE id = 1`,
        )
        .run(content, updatedAt);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return this.getCurrent();
  }

  close(): void {
    this.database.close();
  }
}
