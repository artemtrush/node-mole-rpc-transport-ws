const WsAdapter = require('./WsAdapter');
const readyState = require('./readyState');
const utils = require('./utils');

class TransportClientWS {
    constructor({ wsBuilder, ping, pingInterval = 10000 } = {}) {
        if (!wsBuilder) throw new Error('"wsBuilder" required');
        this.wsBuilder = wsBuilder;
        this.ws = null;
        this.callback = null;
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
        this.callback = callback;
    }

    async sendData(data) {
        try {
            const ws = await this._getWs();

            return ws.send(data);
        } catch (error) {
            // Ignore unexpected errors
        }
    }

    async _prepareWs() {
        const buildedWs = await this.wsBuilder();

        const ws = WsAdapter.wrapIfRequired(buildedWs);

        if (this.callback) {
            ws.off('message', this.callback);
        }

        if (ws.readyState === readyState.CONNECTING) {
            await utils.waitForEvent(ws, 'open');
        }

        if  (this.isPingEnabled && ws.ping) {
            ws.off('pong', this._onPongHandler)
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

            ws.on('pong', this._onPongHandler);
        }

        ws.on('message', this.callback);

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
