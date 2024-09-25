import { exec } from "child_process";
import util from "util";
import mongoose from "mongoose";
import { randomInt } from "crypto";
import path from "path";

/**
 * Convert a PostgreSQL URL to a MongoDB URL using the FerretDB conventions.
 *
 * @param {string} postgresUrl The PostgreSQL URL to convert.
 * @returns {string} The MongoDB URL.
 */
function postgresUrlToMongoUrl(postgresUrl) {
    const [, user, password, , , database] = postgresUrl.match(
        /^postgresql:\/\/(.+):(.+)@(.+?)(:.+)?\/(.+?)(\?.*)?$/
    );

    return `mongodb://${user}:${password}@127.0.0.1/${database}?authMechanism=PLAIN`;
}

/**
 * Start the FerretDB proxy in the background.
 */
function startFerretDB() {
    const execAsync = util.promisify(exec);

    console.log("Starting FerretDB...");

    execAsync(path.resolve("./ferretdb"), {
        cwd: "/tmp",
        env: {
            FERRETDB_POSTGRESQL_URL: process.env.MY_POSTGRES_DATABASE_URL,
            FERRETDB_TELEMETRY: "disable",
            FERRETDB_LISTEN_ADDR: "127.0.0.1:27017",
        },
    }).catch((err) => {
        console.error(err);
    });
}

// Start the FerretDB proxy only once during the cold start of the function
startFerretDB();

// Connect to the MongoDB database
mongoose.connect(postgresUrlToMongoUrl(process.env.MY_POSTGRES_DATABASE_URL));

// Define a Person model
let Person = mongoose.model("Person", { name: String, age: Number });

export const handler = async (_event) => {
    // Save one new person to the database on each function invocation
    const person = new Person({ name: "John Doe", age: randomInt(100) });
    await person.save();

    // Read all persons from the database
    const persons = await Person.find();

    // Return the person array as JSON
    return {
        statusCode: 200,
        body: JSON.stringify({ persons }),
    };
};
