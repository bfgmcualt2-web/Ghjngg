class CasinoMultiplayer {
    constructor({ game, onConnected, onPlayers, onEvent }) {
        this.game = game;
        this.onConnected = onConnected;
        this.onPlayers = onPlayers;
        this.onEvent = onEvent;
        this.socket = null;
        this.channel = null;
        this.peer = null;
        this.dataChannel = null;
        this.room = null;
        this.playerId = globalThis.crypto?.randomUUID?.() || String(Date.now());
        this.name = 'Player';
        this.players = [];
    }

    connect({ name, room, url }) {
        this.name = name || 'Player';
        this.room = room || 'lobby';
        if (url) {
            this.connectWebSocket(url);
            return;
        }
        this.connectBrowserRoom();
    }

    connectWebSocket(endpoint) {
        this.socket = new WebSocket(endpoint);
        this.socket.addEventListener('open', () => {
            this.send({ type: 'join', game: this.game, name: this.name, room: this.room });
        });
        this.socket.addEventListener('message', (event) => this.handleMessage(event));
        this.socket.addEventListener('close', () => this.onEvent?.({ type: 'status', message: 'Disconnected from multiplayer server.' }));
        this.socket.addEventListener('error', () => this.onEvent?.({ type: 'status', message: 'Could not connect to multiplayer server.' }));
    }

    connectBrowserRoom() {
        if (!('BroadcastChannel' in window)) {
            this.onEvent?.({ type: 'status', message: 'This browser does not support no-download rooms. Use WebRTC invite codes instead.' });
            return;
        }
        this.channel = new BroadcastChannel(`casino-${this.game}-${this.room}`);
        this.channel.addEventListener('message', (event) => this.handleMessage({ data: JSON.stringify(event.data) }));
        this.onConnected?.({ id: this.playerId, room: this.room, transport: 'browser-room' });
        this.announcePresence();
    }

    async createPeerInvite({ name, room }) {
        this.name = name || this.name;
        this.room = room || this.room || 'peer-room';
        await this.setupPeer(true);
        const channel = this.peer.createDataChannel('casino-actions');
        this.attachDataChannel(channel);
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        await this.waitForIceGathering();
        return this.encodeSignal({ game: this.game, room: this.room, name: this.name, description: this.peer.localDescription });
    }

    async acceptPeerInvite(invite, { name }) {
        const signal = this.decodeSignal(invite);
        this.name = name || this.name;
        this.room = signal.room || 'peer-room';
        await this.setupPeer(false);
        this.peer.addEventListener('datachannel', (event) => this.attachDataChannel(event.channel));
        await this.peer.setRemoteDescription(signal.description);
        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        await this.waitForIceGathering();
        return this.encodeSignal({ game: this.game, room: this.room, name: this.name, description: this.peer.localDescription });
    }

    async acceptPeerAnswer(answer) {
        const signal = this.decodeSignal(answer);
        await this.peer.setRemoteDescription(signal.description);
        this.onEvent?.({ type: 'status', message: 'Peer answer accepted. Waiting for secure browser connection...' });
    }

    async setupPeer(isHost) {
        this.peer?.close();
        this.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        this.peer.addEventListener('connectionstatechange', () => {
            this.onEvent?.({ type: 'status', message: `Peer connection: ${this.peer.connectionState}` });
        });
        this.peer.addEventListener('iceconnectionstatechange', () => {
            this.onEvent?.({ type: 'status', message: `Network negotiation: ${this.peer.iceConnectionState}` });
        });
        this.onEvent?.({ type: 'status', message: isHost ? 'Host invite created. Share it with another player.' : 'Invite accepted. Send the answer code back to the host.' });
    }

    attachDataChannel(channel) {
        this.dataChannel = channel;
        channel.addEventListener('open', () => {
            this.onConnected?.({ id: this.playerId, room: this.room, transport: 'webrtc' });
            this.updatePlayers([{ id: this.playerId, name: this.name }, { id: 'peer', name: 'Connected Player' }]);
            this.sendPeer({ type: 'presence', game: this.game, id: this.playerId, name: this.name });
        });
        channel.addEventListener('message', (event) => this.handleMessage(event));
        channel.addEventListener('close', () => this.onEvent?.({ type: 'status', message: 'Peer disconnected.' }));
    }

    waitForIceGathering() {
        if (this.peer.iceGatheringState === 'complete') return Promise.resolve();
        return new Promise((resolve) => {
            const done = () => {
                if (this.peer.iceGatheringState === 'complete') {
                    this.peer.removeEventListener('icegatheringstatechange', done);
                    resolve();
                }
            };
            this.peer.addEventListener('icegatheringstatechange', done);
            setTimeout(resolve, 2500);
        });
    }

    encodeSignal(payload) {
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    }

    decodeSignal(code) {
        return JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    }

    announcePresence() {
        this.updatePlayers([{ id: this.playerId, name: this.name }]);
        this.channel?.postMessage({ type: 'presence', game: this.game, id: this.playerId, name: this.name });
    }

    handleMessage(event) {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (message.game && message.game !== this.game) return;
        if (message.id === this.playerId || message.from === this.playerId) return;
        if (message.type === 'joined') {
            this.playerId = message.id;
            this.onConnected?.(message);
        }
        if (message.type === 'players') this.updatePlayers(message.players);
        if (message.type === 'presence') {
            const alreadyKnown = this.players.some((player) => player.id === message.id);
            const nextPlayers = [...this.players.filter((player) => player.id !== message.id), { id: message.id, name: message.name }];
            this.updatePlayers(nextPlayers);
            if (!alreadyKnown) {
                this.channel?.postMessage({ type: 'presence', game: this.game, id: this.playerId, name: this.name });
            }
        }
        this.onEvent?.(message);
    }

    updatePlayers(players) {
        this.players = players;
        this.onPlayers?.(players);
    }

    broadcastAction(action, payload = {}) {
        this.send({ type: 'action', game: this.game, action, payload, from: this.playerId, fromName: this.name });
    }

    send(payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
            return;
        }
        if (this.channel) {
            this.channel.postMessage(payload);
            return;
        }
        this.sendPeer(payload);
    }

    sendPeer(payload) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(payload));
        }
    }
}

window.CasinoMultiplayer = CasinoMultiplayer;
