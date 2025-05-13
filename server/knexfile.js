/** @type {import('knex').Knex.Config} */
require('dotenv').config();

const dbConfig = process.env.DATABASE_URL
  ? {
      client: 'pg',
      connection: process.env.DATABASE_URL,
      migrations: {
        directory: './migrations'
      },
      seeds: {
        directory: './seeds'
      }
    }
  : {
      client: 'sqlite3',
      connection: {
        filename: './dev.sqlite3'
      },
      useNullAsDefault: true,
      migrations: {
        directory: './migrations'
      },
      seeds: {
        directory: './seeds'
      }
    };

module.exports = dbConfig;
