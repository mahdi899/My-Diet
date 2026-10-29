import { types } from 'pg';

/** Keep PostgreSQL DATE as YYYY-MM-DD. A JS Date would move the civil day around midnight. */
types.setTypeParser(1082, (value: string) => value);
