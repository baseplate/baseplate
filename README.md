# 🏗 Baseplate

## Prerequisites

- [Node.js](https://nodejs.org/en/download/) and npm
- (Optional) A [MongoDB database](https://docs.mongodb.com/manual/installation/) if you want to run your database locally. Alternatively, you can use the self-hosted, development database for testing purposes. Read below for more details.

## Development database

If you're looking to try the application without having to install amd set up a database, you can use the Baseplate development database, hosted on mLab. The details are included in the `serverless.json` file, so that the application automatically connects to the database without any further setup required.

There are two existing users with different access levels:

- `admin@baseplate.app` / `qFr2DSsRJJNQh7kM` (admin)
- `user@baseplate.app` / `gAU6RYJtjP3j3AyM` (user)

## Usage

1. Install dependencies

   ```sh
   npm install
   ```

1. Run development server

   ```sh
   npm run dev
   ```

1. Obtain an access token for the user you want to use

   ```sh
   POST http://localhost:3000/base_users/token

   {
      "grant_type": "password",
      "username": "admin@baseplate.app",
      "password": "qFr2DSsRJJNQh7kM"
   }
   ```

1. Grab the access token in the `access_token` field from the response

1. Access sample model, passing the access token in the `Authorization` header

   ```
   GET http://localhost:3000/books

   Authorization: Bearer <your-access-token>
   ```

### Change database

If you'd like to run Baseplate with your own database, run the app with the following environment variables:

- `MONGODB_HOST`: The value of the host and port (e.g. `mydb.com:12345`)
- `MONGODB_USERNAME`: The database username
- `MONGODB_PASSWORD`: The database password
- `MONGODB_DATABASE`: The database name

You must also create the first user using the command-line:

```sh
BASEPLATE_ACCESS_LEVEL=admin BASEPLATE_USERNAME=<your-username> BASEPLATE_PASSWORD=<your-password> node scripts/createUser.js
```

## Contributing

This project uses the [ESLint](https://eslint.org/) linter and the [Prettier](https://prettier.io/) code formatter.

To ensure your code conforms to the rules, run `npm run format`.
