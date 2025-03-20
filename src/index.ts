import * as pty from 'node-pty';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';

const PORT = parseInt(process.env.PORT || '10086');

const wss = new WebSocketServer({
  port: PORT,
});

wss.on('listening', () => {
  console.log('start at', formatAddressInfo(wss.address()));
});

wss.on('connection', (ws) => {
  try {
    const decoder = new TextDecoder();

    const cp = pty.spawn('/bin/bash', [], {
      name: 'xterm-256color',
      cwd: process.env.HOME,
    });

    ws.on('error', (err) => {
      cp.kill();
      ws.close();
    });

    cp.onData((data) => {
      ws.send('0:' + data);
    });

    cp.onExit((event) => {
      ws.send(`1:${JSON.stringify({ ...event, command: 'exit' })}`);
      ws.close();
    });

    ws.on('message', (message) => {
      const raw = decoder.decode(message as Buffer);
      const proto = raw[0];
      const content = raw.slice(2);
      if (proto === '0') {
        cp.write(content);
      } else if (proto === '1') {
        const command = JSON.parse(content);
        switch (command.command) {
          case 'resize':
            cp.resize(command.cols, command.rows);
        }
      }
    });
  } catch (e) {
    ws.send(`1:${JSON.stringify({ command: 'spawn-error' })}`);
  }
});

function formatAddressInfo (address: AddressInfo | string | null) {
  if (address) {
    if (typeof address === 'string') {
      return address;
    } else {
      return `[${address.family}]${address.address}:${address.port}`;
    }
  }
  return 'unknown-address';
}
