import { MongoError } from 'mongodb';

type Doc = Record<string, any>;

const tick = (): Promise<void> => Promise.resolve();

const matches = (doc: Doc, filter: Doc): boolean =>
  Object.entries(filter).every(([key, expected]) =>
    expected && typeof expected === 'object' && '$regex' in expected
      ? new RegExp(expected.$regex as string).test(doc[key])
      : doc[key] === expected,
  );

/**
 * A small in-memory stand-in for the MongoDB collection used by WealthService.
 * It supports equality and `$regex` filters, `sort`, `limit`, and a unique
 * index like the one created by MongoProvider: inserting a document whose
 * unique key already exists fails with duplicate-key error 11000.
 */
export class FakeCollection {
  readonly docs: Doc[] = [];

  constructor(
    private readonly uniqueKeys: string[] = [
      'userId',
      'provider',
      'transactionId',
    ],
  ) {}

  async findOne(filter: Doc): Promise<Doc | null> {
    await tick();
    const found = this.docs.find((doc) => matches(doc, filter));
    return found ? { ...found } : null;
  }

  async insertOne(doc: Doc): Promise<void> {
    await tick();
    const duplicate = this.docs.some((existing) =>
      this.uniqueKeys.every((key) => existing[key] === doc[key]),
    );
    if (duplicate) {
      throw Object.assign(new MongoError('E11000 duplicate key error'), {
        code: 11000,
      });
    }
    this.docs.push({ ...doc });
  }

  find(filter: Doc) {
    let sortSpec: Record<string, 1 | -1> = {};
    let max = Infinity;
    const cursor = {
      sort: (spec: Record<string, 1 | -1>) => {
        sortSpec = spec;
        return cursor;
      },
      limit: (n: number) => {
        max = n;
        return cursor;
      },
      toArray: async (): Promise<Doc[]> => {
        await tick();
        const rows = this.docs
          .filter((doc) => matches(doc, filter))
          .map((doc) => ({ ...doc }));
        rows.sort((a, b) => {
          for (const [key, direction] of Object.entries(sortSpec)) {
            if (a[key] < b[key]) return -direction;
            if (a[key] > b[key]) return direction;
          }
          return 0;
        });
        return rows.slice(0, max);
      },
    };
    return cursor;
  }
}

export const fakeMongoProvider = (collection: FakeCollection) => ({
  getDb: () => ({ collection: () => collection }),
});
