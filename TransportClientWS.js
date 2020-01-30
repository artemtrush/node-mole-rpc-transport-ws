const readyState = require('./readyState');
const utils = require('./utils');

class TransportClientWS {
    constructor({ wsBuilder, ping, pingInterval = 10000 } = {}) {
        if (!wsBuilder) throw new Error('"wsBuilder" required');
        this.wsBuilder = wsBuilder;
        this.ws = null;
        this.callback = null
        this.isPingEnabled = ping;
        this.pingInterval = pingInterval;

        if (this.isPingEnabled) {
            this._timerId = null;
            this._isAlive = true;
            this._onPongHandler = () => {
                this._isAlive = true;
            }
        }
    }

    async onData(callback) {
        this.callback = (message) => {
            callback(message.data)
        };
    }

    async sendData(data) {
        try{
            const ws = await this._getWs();
            return ws.send(data);

        } catch(_){ }
    }

    async _prepareWs() {
        const ws = this.wsBuilder();

        ws.removeEventListener('message', this.callback)

        if (ws.readyState === readyState.CONNECTING) {
            await utils.waitForEvent(ws, 'open');
        }

        if  (this.isPingEnabled && ws.ping) {
            ws.removeEventListener('pong', this._onPongHandler)
            clearInterval(this._timerId);
            this._isAlive = true;

            this._timerId = setInterval(() => {
                if (!this._isAlive) {
                    ws.terminate();

                    return clearInterval(this._timerId);
                }

                this._isAlive = false;
                if(ws.readyState === readyState.OPEN) ws.ping();
            }, this.pingInterval);

            ws.addEventListener('pong', this._onPongHandler);
        }

        ws.addEventListener('message', this.callback);

        return ws;
    }

    async _getWs() {
        if (this.ws && this.ws.readyState === readyState.OPEN) {
            return this.ws;
        } else {
            this.ws = await this._prepareWs();
            return this.ws;
        }
    }
}

module.exports = TransportClientWS;
