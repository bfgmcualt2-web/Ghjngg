class CasinoMultiplayer {
    constructor({ game, onConnected, onPlayers, onEvent }) {
        this.game = game;
        this.onConnected = onConnected;
        this.onPlayers = onPlayers;
        this.onEvent = onEvent;
        this.socket = null;
        this.room = null;
        this.playerId = null;
    }

    connect({ name, room, url }) {
        this.room = room || 'lobby';
        const endpoint = url || this.defaultUrl();
        this.socket = new WebSocket(endpoint);
        this.socket.addEventListener('open', () => {
            this.send({ type: 'join', game: this.game, name: name || 'Player', room: this.room });
        });
        this.socket.addEventListener('message', (event) => this.handleMessage(event));
        this.socket.addEventListener('close', () => this.onEvent?.({ type: 'status', message: 'Disconnected from multiplayer server.' }));
        this.socket.addEventListener('error', () => this.onEvent?.({ type: 'status', message: 'Could not connect to multiplayer server.' }));
    }

    defaultUrl() {
        if (location.protocol === 'file:') return 'ws://localhost:8080';
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${location.host}`;
    }

    handleMessage(event) {
        const message = JSON.parse(event.data);
        if (message.type === 'joined') {
            this.playerId = message.id;
            this.onConnected?.(message);
        }
        if (message.type === 'players') this.onPlayers?.(message.players);
        this.onEvent?.(message);
    }

    broadcastAction(action, payload = {}) {
        this.send({ type: 'action', game: this.game, action, payload });
    }

    send(payload) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
        }
    }
}

window.CasinoMultiplayer = CasinoMultiplayer;
