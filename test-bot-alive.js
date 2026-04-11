const net = require('net');
const client = new net.Socket();
client.connect(5005, '127.0.0.1', () => {
    console.log('Bot Connected!');
    client.write('HELLO scarlet\n');
});
client.on('error', () => {});
// Keep alive
setInterval(() => {}, 100000);
