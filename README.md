# 🏗 Baseplate

> ✋&nbsp; If you just want to experiment with Baseplate, you might want to check out one of the [example projects](https://github.com/baseplate/examples). If you're looking to work on the framework itself, read on.

## Introduction

This repository contains the API component of Baseplate. It is a [monorepo](https://en.wikipedia.org/wiki/Monorepo) comprised of the following packages:

- 🧠&nbsp; **`core`**: The core application logic.
- 📀&nbsp; **`db-mongodb`**: A database connector for [MongoDB](https://www.mongodb.com/).
- 💿&nbsp; **`db-postgresql`**: A database connector for [PostgreSQL](https://www.postgresql.org/) (**not ready**).
- 📖&nbsp; **`schema`**: A module for representing model schemas and validating documents against them. Can run both server-side and client-side.
- ⚙️&nbsp; **`server`**: A web server to run Baseplate.
- ☁️&nbsp; **`serverless`**: Wrapper functions for running Baseplate in a serverless setup (**not ready**).

Baseplate uses a modular architecture, allowing developers to pick just the components they need for any given project.

For example, if you wanted to run Baseplate with a MongoDB database and deploy it with a web server, you'd install `db-mongodb` and `server`. The data connector modules include `core` themselves, so you don't need to install it yourself.

<details>
   <summary>✏️&nbsp; Example</summary>

```ts
import baseplateServer from '@baseplate/server'
import * as baseplateCore from '@baseplate/mongodb'

import Actor from './models/Actor'
import Movie from './models/Movie'

baseplateCore.initialize({
  models: [Actor, Movie],
})

baseplateServer(baseplateCore)
  .start({
    host: 'localhost',
    port: 8000,
  })
  .then(() => {
    console.log('🦄')
  })
```

</details>

## Installation

1. Install development dependencies

   ```sh
   npm install
   ```

1. Install dependencies of each package

   ```sh
   lerna bootstrap
   ```

1. Compile the TypeScript files and watch for changes

   ```sh
   npm run watch
   ```

## Testing

To start the test suite, run `npm run test`. If you're working on a test and you want it to run automatically as you change the code, you can run the test suite in watch mode with `npm run test:watch`.

## Contributing

This project is written in [TypeScript](https://www.typescriptlang.org/). It uses the [ESLint](https://eslint.org/) linter and the [Prettier](https://prettier.io/) code formatter.

To ensure your code conforms to the rules, run `npm run format`.
