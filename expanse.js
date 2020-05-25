//
// Modules
//

const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs");


//
// Constants
//

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";


//
// Functions
//

async function execute(command) {
    let { stdout, stderr } = await exec(command);
    return {
        output: stdout,
        error: stderr
    };
}

function generateString(size) {
    let key = "";
    for (let ctr = 0; ctr < size; ctr++) {
        key += chars.charAt(Math.round(Math.random() * (chars.length - 1)));
    }
    return key;
}


//
// Expanse Class
//

class Expanse() {

    LOGS = "./expanse/logs";
    SERVERS = [];

    // @options - object
    //   logs: Where logs are stored, full path
    constructor(options) {
        if (options) {
            if (options.logs) {
                LOGS = options.logs;
            }
        }
        await execute(`mkdir -p ${LOGS}`);
    }

    // @server - object
    //   label:         Name of the server
    //   host:          The server address
    //   port:          SSH port
    //   username:      SSH Username
    //   password:      SSH Password
    //   key:           SSH Key
    function addServer(server) {
        if (!server.host ||
            !server.port ||
            !server.username ||
            !server.label ||
            (!server.password && !server.key)) {
            throw new Error('Server is missing critical information!');
        }

        for (let i = 0; i < SERVERS.length; i++) {
            if ((SERVERS[i].host === server.host && 
                SERVERS[i].port === server.port &&
                SERVERS[i].username === server.username) ||
                SERVERS[i].label === server.label) {
                throw new Error(`Server: ${server.username}@${server.host}:${server.port} is already on being controlled!`);
            }
        }
        SERVERS.push(server);
    }

    // @return - array
    //   result - objecy
    //     output: Output from server
    //     error:  Any error thrown
    //     server: Server the results pertains to
    function removeServer(server) {
        if (!server.host ||
            !server.port ||
            !server.username) {
            throw new Error('Server is missing critical information!');
        }

        for (let i = 0; i < SERVERS.length; i++) {
            if (SERVERS[i].host === server.host && 
                SERVERS[i].port === server.port &&
                SERVERS[i].username === server.username) {
                SERVERS.splice(i, 1);
                return;
            }
        }
        throw new Error(`Server: ${server.username}@${server.host}:${server.port} is not being controlled!`);
    }

    // @return - array
    //   result - objecy
    //     output: Output from server
    //     error:  Any error thrown
    //     server: Server the results pertains to
    async function executeCommand(command) {
        let idList = [];
        let requests = [];
        let results = [];

        for (let i = 0; i < SERVERS.length; i++) {
            let server = SERVERS[i];
            let sshCommand = "ssh ";
            let commandID;

            do {
                commandID = generateString(16);
            } while (idList.includes(commandID));

            if (server.password) {
                process.env[`PASS_${commandID}`] = server.password;
                sshCommand = `sshpass -p "$PASS_${commandID}" ssh `;
            } else {
                sshCommand = `ssh -i "${server.key}" `;
            }

            sshCommand += `-p ${server.port} ${server.username}@${server.host} ${command}`

            requests.push(execute(sshCommand).then(result => {
                if (server.password) {
                    process.env[`PASS_${commandID}`] = null;
                }

                for (let x = 0; x < result.output.length) {
                    fs.appendFileSync(`${LOGS}/${server.label}.log`, result.output[x], function (err) {
                        if (err)
                            console.error(`Failed writing to: ${LOGS}/${server.label}.log, Error: ${err}`);
                    });
                }
                result.server = server;
                results.push(result);
            }));            
        }
        await Promise.all(requests);
        return results;
    }

    // @return - array
    //   output: Output from server
    //   error:  Any error thrown
    //   server: Server the results pertains to
    async function transfer(file, location) {
        let idList = [];
        let requests = [];
        let results = [];

        for (let i = 0; i < SERVERS.length; i++) {
            let server = SERVERS[i];
            let scpCommand = "scp ";
            let commandID;

            do {
                commandID = generateString(16);
            } while (idList.includes(commandID));

            if (server.password) {
                process.env[`PASS_${commandID}`] = server.password;
                scpCommand = `sshpass -p "$PASS_${commandID}" scp `;
            } else {
                scpCommand = `scp -i "${server.key}" `;
            }

            scpCommand += `-r -P ${server.port} "${file}" "${server.username}@${server.host}:${file}"`

            requests.push(execute(scpCommand).then(result => {
                if (server.password) {
                    process.env[`PASS_${commandID}`] = null;
                }

                for (let x = 0; x < result.output.length) {
                    fs.appendFileSync(`${LOGS}/${server.label}.log`, result.output[x], function (err) {
                        if (err)
                            console.error(`Failed writing to: ${LOGS}/${server.label}.log, Error: ${err}`);
                    });
                }
                result.server = server;
                results.push(result);
            }));
        }
        await Promise.all(requests);
        return results;
    }
}


//
// Exports
//

export default Expanse;