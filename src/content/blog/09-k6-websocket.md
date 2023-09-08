---
title: "k6: How to test you signalR websockets"
description: At this article I'll share how to load test backend which was written using signalR library.
pubDate: 2023-09-08
# updatedDate: 2023-09-05
hero: "../../assets/images/09-k6-websockets.webp"
heroAlt: "k6 + websockets"
---

Hello, Today i'm gonna show you how to load test websockets using k6 tool.

## What is k6?

[Grafana k6](https://k6.io/docs#:~:text=What%20is%20k6%3F,performance%20regressions%20and%20problems%20earlier.) is an open-source load testing tool that makes performance testing easy and productive for engineering teams

## What is websockets?

WebSockets is a internet communication protocol between client and server.

unlike HTTP - websockets are bi-directional internet protocol, unlike HTTP it starts from `ws://` or `wss://`. It is a stateful protocol, which means the connection between client and server will keep alive until it is terminated by either party (client or server).

![how ws works](../../assets/images/09-websocket-works.webp)
> Image 1. Websocket connection schema

## Where used websockets?

Websockets are very useful when you would like to show information in realtime. It can be chat application (like slack, teams or google chat) or online games or Crypto Market(like Binance).

### Chrome Devtools

Chrome devtools protocol are also using websocket to communicate between different layers in bi-directional way.

Here is an example of communication in chrome devtools protocols. Where client is a `browser`(or what end-user see on the screen) and `server` - is a browser internals(like v8 - JS executor, html rendering, network, etc.)

### from client to server

- newTab(url?) - opens new tab with selected url(or default screen)
- newUrl(url) - change current tab URL and open it
- closeTab

etc.

### from server to client

- render HTML(with CSS styles)
- recalculate styles (e.g. when animation is triggers)
- call network request on the page
- JS parsing
- JS execution

etc.

## Application example

Before start testing - you need an app which you will test in.

Let's assume that this application is already exists.

And you test API will be looks like this:

```txt
[POST] /account/login -> returns accessToken field

[GET] /account/ws/account -> returns `Websocket` upgrading connection and subscribes into account updates

[POST] /account/update -> updates user info, triggers `/account/ws/account` socket connections
```

## Installing k6

from [official documentation](https://k6.io/docs/get-started/installation/): we need to install external binary file and install on your machine.

Since I'm using mac: just use [`homebrew`](https://brew.sh/) and it will looks like this:

```bash
brew install k6
```

## load test scenario

### Remark: signalR

`signalR` - is a library to handle websocket using ASP.NET client. It also has implementation for JavaScript/Typescript. and it's name [`@microsoft/signalr`](https://www.npmjs.com/package/@microsoft/signalr)

Let's write some scenario:

```js
// account.test.js
import check from 'k6/check'
import http from 'k6/http'
import ws from 'k6/ws'


// ESSENTIAL:
export default function(){
  const loginResponse = http.post(`{BASE_URL}/account/login`);

  check(loginResponse, {
    'status is 200': () => loginResponse.status === 200,
  })

  const token = loginResponse.json('accessToken')
  let data = [];
  let socket = null
  const wsResponse = ws.connect(`{BASE_URL}/account/ws/account`, socket => {
    socket = socket
    socket.on('open', () => {
      // ESSENTIAL
      // from: https://stackoverflow.com/a/76677753
      socket.send(JSON.stringify({ protocol: 'json', version: 1 }) + '\x1e')
    })
    socket.on('message', (data) => {
      // data example: [{field1: "value 1"}]
      const msg = JSON.parse(msg) // backend returns objects as string
      data = msg;
    })
  })

  const updateResponse = http.post(`{BASE_URL}/account/update`);

  check(updateResponse, {
    'status is 200': () => updateResponse.status === 200,
  })

  check(data, {
    "0 element should be 'value 1'": () => data[0].field1 === 'value 1'
  })

  // end test. close socket.
  // otherwise test will never ends
  socket.close();
}
```

## Notes & Observations

1. We need to send next JSON(`{ protocol: 'json', version: 1 }`) - otherwise signalR will reject handshake.
2. On each message - you need to add at the end of string `\x1e`. This symbol means ASCII "Record Separator". SignalR used it as "end of sended message".
3. if you send something on your backend - make sure that `invocationId` is unique(e.g. increment after send info on the server), or you'll get an error from signalR backend.

Let's execute it by following command:

```bash
k6 account.test.js
```

And the report will be looks like screen below:

![result](../../assets/images/09-websocket-result.png)
> Image 2. execution result. See at `ws_*` line.

That's it! See you soon!

## Bye
