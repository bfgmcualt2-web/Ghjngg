// Game State
const gameState = {
    balance: 1000,
    currentBet: 0,
    playerHand: [],
    dealerHand: [],
    gameActive: false,
    gameOver: false,
    history: [],
    mode: null,
    multiplayer: null
};


function selectGameMode(mode) {
    gameState.mode = mode;
    document.getElementById('modeSelect').style.display = 'none';
    document.getElementById('modeBadge').textContent = mode === 'multiplayer' ? 'Multiplayer table' : 'Offline table';
    if (mode === 'multiplayer') {
        document.getElementById('multiplayerPanel').style.display = '';
        document.getElementById('resultMessage').textContent = 'Open a browser room or exchange WebRTC invite codes to play with another person without downloading anything.';
        return;
    }
    document.querySelectorAll('.game-content').forEach((section) => {
        section.style.display = '';
    });
    document.getElementById('resultMessage').textContent = 'Offline mode selected. Beat the dealer solo.';
}


function connectMultiplayer() {
    ensureMultiplayerClient();
    gameState.multiplayer.connect({
        name: document.getElementById('playerName').value,
        room: document.getElementById('roomCode').value,
        url: document.getElementById('serverUrl').value
    });
}


async function createPeerInvite() {
    ensureMultiplayerClient();
    const output = await gameState.multiplayer.createPeerInvite({
        name: document.getElementById('playerName').value,
        room: document.getElementById('roomCode').value
    });
    document.getElementById('peerOutput').value = output;
    document.getElementById('multiplayerStatus').textContent = 'Host invite ready. Send this code to the other player.';
}

async function joinPeerInvite() {
    ensureMultiplayerClient();
    const output = await gameState.multiplayer.acceptPeerInvite(document.getElementById('peerInvite').value, {
        name: document.getElementById('playerName').value
    });
    document.getElementById('peerOutput').value = output;
    document.getElementById('multiplayerStatus').textContent = 'Answer ready. Send this answer code back to the host.';
}

async function acceptPeerAnswer() {
    ensureMultiplayerClient();
    await gameState.multiplayer.acceptPeerAnswer(document.getElementById('peerInvite').value);
    document.getElementById('multiplayerStatus').textContent = 'Answer accepted. Browser peer connection is starting.';
}

function ensureMultiplayerClient() {
    if (gameState.multiplayer) return;
    gameState.multiplayer = new CasinoMultiplayer({
        game: 'blackjack',
        onConnected: (event) => {
            document.getElementById('multiplayerStatus').textContent = `Connected via ${event.transport || 'multiplayer'}. You can play together now.`;
            document.querySelectorAll('.game-content').forEach((section) => {
                section.style.display = '';
            });
        },
        onPlayers: renderPlayers,
        onEvent: (event) => {
            if (event.type === 'action' && event.fromName) {
                document.getElementById('multiplayerStatus').textContent = `${event.fromName}: ${event.action}`;
            }
            if (event.type === 'status') {
                document.getElementById('multiplayerStatus').textContent = event.message;
            }
        }
    });
}

function renderPlayers(players) {
    document.getElementById('playersList').innerHTML = players
        .map((player) => `<span class="player-pill">${player.name}</span>`)
        .join('');
}

function broadcastMultiplayerAction(action, payload = {}) {
    if (gameState.mode === 'multiplayer') {
        gameState.multiplayer?.broadcastAction(action, payload);
    }
}

// Card values and suits
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Create a deck of cards
function createDeck() {
    const deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ rank, suit });
        }
    }
    // Shuffle deck
    return deck.sort(() => Math.random() - 0.5);
}

let deck = createDeck();

// Get card value
function getCardValue(card) {
    if (card.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return parseInt(card.rank);
}

// Calculate hand value
function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;

    for (let card of hand) {
        value += getCardValue(card);
        if (card.rank === 'A') aces++;
    }

    // Adjust for aces if over 21
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }

    return value;
}

// Display cards
function getCardClass(card) {
    return ['♥', '♦'].includes(card.suit) ? 'card red' : 'card';
}

function displayCards() {
    const playerCardsDiv = document.getElementById('playerCards');
    const dealerCardsDiv = document.getElementById('dealerCards');

    // Display player cards
    playerCardsDiv.innerHTML = '';
    gameState.playerHand.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = getCardClass(card);
        cardDiv.textContent = card.rank + card.suit;
        playerCardsDiv.appendChild(cardDiv);
    });

    // Display dealer cards
    dealerCardsDiv.innerHTML = '';
    gameState.dealerHand.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = getCardClass(card);
        if (index === gameState.dealerHand.length - 1 && !gameState.gameOver) {
            // Hide last dealer card until game is over
            cardDiv.className += ' hidden';
            cardDiv.textContent = '';
        } else {
            cardDiv.textContent = card.rank + card.suit;
        }
        dealerCardsDiv.appendChild(cardDiv);
    });

    // Update values
    document.getElementById('playerValue').textContent = calculateHandValue(gameState.playerHand);
    
    let dealerValue = calculateHandValue(gameState.dealerHand);
    if (!gameState.gameOver && gameState.dealerHand.length > 0) {
        // Only show first card value until game is over
        dealerValue = getCardValue(gameState.dealerHand[0]);
        if (gameState.dealerHand[0].rank === 'A') {
            dealerValue = 11;
        }
    }
    document.getElementById('dealerValue').textContent = dealerValue;
}

// Place bet
function placeBet() {
    const betAmount = parseInt(document.getElementById('betAmount').value);

    if (isNaN(betAmount) || betAmount < 10) {
        alert('Minimum bet is $10');
        return;
    }

    if (betAmount > gameState.balance) {
        alert('Insufficient balance');
        return;
    }

    gameState.currentBet = betAmount;
    gameState.balance -= betAmount;
    document.getElementById('balance').textContent = gameState.balance;

    broadcastMultiplayerAction('deal', { bet: betAmount });
    startGame();
}

// Quick bet
function quickBet(amount) {
    document.getElementById('betAmount').value = amount;
    placeBet();
}

// Start game
function startGame() {
    // Reset hands
    gameState.playerHand = [];
    gameState.dealerHand = [];
    gameState.gameActive = true;
    gameState.gameOver = false;

    // Reshuffle if less than 20 cards left
    if (deck.length < 20) {
        deck = createDeck();
    }

    // Deal initial cards
    gameState.playerHand.push(deck.pop());
    gameState.dealerHand.push(deck.pop());
    gameState.playerHand.push(deck.pop());
    gameState.dealerHand.push(deck.pop());

    // Hide betting section and show controls
    document.getElementById('bettingSection').style.display = 'none';
    document.getElementById('gameControls').style.display = 'flex';
    document.getElementById('resultMessage').innerHTML = '';

    displayCards();

    // Check for blackjack
    const playerValue = calculateHandValue(gameState.playerHand);
    if (playerValue === 21 && gameState.playerHand.length === 2) {
        setTimeout(() => {
            dealerPlay();
        }, 500);
        return;
    }

    // Check for dealer blackjack
    const dealerValue = calculateHandValue(gameState.dealerHand);
    if (dealerValue === 21 && gameState.dealerHand.length === 2) {
        setTimeout(() => {
            dealerPlay();
        }, 500);
        return;
    }
}

// Hit
function hit() {
    if (!gameState.gameActive) return;

    gameState.playerHand.push(deck.pop());
    broadcastMultiplayerAction('hit');
    displayCards();

    const playerValue = calculateHandValue(gameState.playerHand);
    if (playerValue > 21) {
        endGame('loss', 'Bust! You went over 21.');
    } else if (playerValue === 21) {
        setTimeout(() => {
            stand();
        }, 500);
    }
}

// Stand
function stand() {
    if (!gameState.gameActive) return;
    broadcastMultiplayerAction('stand');
    dealerPlay();
}

// Dealer plays
function dealerPlay() {
    gameState.gameActive = false;
    displayCards();

    // Dealer must hit on 16 or less
    let dealerValue = calculateHandValue(gameState.dealerHand);

    const dealerInterval = setInterval(() => {
        dealerValue = calculateHandValue(gameState.dealerHand);

        if (dealerValue >= 17) {
            clearInterval(dealerInterval);
            gameState.gameOver = true;
            displayCards();
            determineWinner();
        } else {
            gameState.dealerHand.push(deck.pop());
            displayCards();
        }
    }, 800);
}

// Determine winner
function determineWinner() {
    const playerValue = calculateHandValue(gameState.playerHand);
    const dealerValue = calculateHandValue(gameState.dealerHand);

    const playerBlackjack = gameState.playerHand.length === 2 && playerValue === 21;
    const dealerBlackjack = gameState.dealerHand.length === 2 && dealerValue === 21;

    let result = '';
    let messageClass = '';
    let resultType = '';

    if (playerBlackjack && dealerBlackjack) {
        result = 'Push! Both have Blackjack.';
        messageClass = 'draw';
        resultType = 'draw';
        gameState.balance += gameState.currentBet; // Return bet
    } else if (playerBlackjack) {
        const winnings = Math.floor(gameState.currentBet * 2.5); // 1.5x payout for blackjack
        result = `🎉 Blackjack! You won $${winnings - gameState.currentBet}!`;
        messageClass = 'blackjack';
        resultType = 'win';
        gameState.balance += winnings;
    } else if (dealerBlackjack) {
        result = 'Dealer has Blackjack. You lost.';
        messageClass = 'loss';
        resultType = 'loss';
    } else if (playerValue > 21) {
        result = 'Bust! You went over 21. You lost.';
        messageClass = 'loss';
        resultType = 'loss';
    } else if (dealerValue > 21) {
        const winnings = gameState.currentBet * 2;
        result = `Dealer busts! You won $${gameState.currentBet}!`;
        messageClass = 'win';
        resultType = 'win';
        gameState.balance += winnings;
    } else if (playerValue > dealerValue) {
        const winnings = gameState.currentBet * 2;
        result = `You won $${gameState.currentBet}!`;
        messageClass = 'win';
        resultType = 'win';
        gameState.balance += winnings;
    } else if (dealerValue > playerValue) {
        result = 'Dealer wins. You lost.';
        messageClass = 'loss';
        resultType = 'loss';
    } else {
        result = 'Push! It\'s a tie.';
        messageClass = 'draw';
        resultType = 'draw';
        gameState.balance += gameState.currentBet; // Return bet
    }

    document.getElementById('balance').textContent = gameState.balance;
    displayResult(result, messageClass);
    addToHistory(resultType, playerValue, dealerValue);
}

// Display result
function displayResult(message, className) {
    const resultDiv = document.getElementById('resultMessage');
    resultDiv.textContent = message;
    resultDiv.className = 'result-message ' + className;
}

// Add to history
function addToHistory(resultType, playerValue, dealerValue) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item ' + resultType;

    const resultText = resultType.charAt(0).toUpperCase() + resultType.slice(1);
    const betText = gameState.currentBet > 0 ? ` - Bet: $${gameState.currentBet}` : '';
    historyItem.textContent = `${resultText}: You ${playerValue} vs Dealer ${dealerValue}${betText}`;

    const historyDiv = document.getElementById('history');
    historyDiv.insertBefore(historyItem, historyDiv.firstChild);

    // Keep only last 10 items
    while (historyDiv.children.length > 10) {
        historyDiv.removeChild(historyDiv.lastChild);
    }
}

// End game (for bust)
function endGame(resultType, message) {
    gameState.gameActive = false;
    gameState.gameOver = true;
    displayResult(message, resultType);
    addToHistory(resultType, calculateHandValue(gameState.playerHand), 0);
    document.getElementById('gameControls').style.display = 'flex';
}

// Reset game
function resetGame() {
    if (gameState.balance <= 0) {
        alert('Game Over! You\'re out of money. Refresh the page to restart.');
        return;
    }

    document.getElementById('bettingSection').style.display = 'block';
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('resultMessage').innerHTML = '';
    document.getElementById('playerCards').innerHTML = '';
    document.getElementById('dealerCards').innerHTML = '';
    broadcastMultiplayerAction('new-round');
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('balance').textContent = gameState.balance;
});