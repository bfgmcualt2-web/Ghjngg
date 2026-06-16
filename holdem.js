// Game State
const pokerState = {
    balance: 1000,
    pot: 0,
    currentBet: 0,
    playerHand: [],
    communityCards: [],
    gameActive: false,
    gamePhase: 'pre-flop',
    opponent1Stack: 1000,
    opponent2Stack: 1000,
    opponent1Hand: [],
    opponent2Hand: [],
    opponent1Fold: false,
    opponent2Fold: false,
    history: []
};

// Card values and suits
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Create a deck
function createDeck() {
    const deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ rank, suit });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

let deck = createDeck();

// Display cards
function getCardClass(card) {
    return ['♥', '♦'].includes(card.suit) ? 'card red' : 'card';
}

function displayCards() {
    const playerCardsDiv = document.getElementById('playerCards');
    playerCardsDiv.innerHTML = '';
    
    pokerState.playerHand.forEach((card) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = getCardClass(card);
        cardDiv.textContent = card.rank + card.suit;
        playerCardsDiv.appendChild(cardDiv);
    });

    const communityDiv = document.getElementById('communityCards');
    communityDiv.innerHTML = '';
    
    pokerState.communityCards.forEach((card) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = getCardClass(card);
        cardDiv.textContent = card.rank + card.suit;
        communityDiv.appendChild(cardDiv);
    });
}

// Start poker hand
function startPokerHand() {
    const blind = parseInt(document.getElementById('betAmount').value);

    if (isNaN(blind) || blind < 10) {
        alert('Minimum blind is $10');
        return;
    }

    if (blind > pokerState.balance) {
        alert('Insufficient balance');
        return;
    }

    // Reset hand
    pokerState.playerHand = [];
    pokerState.opponent1Hand = [];
    pokerState.opponent2Hand = [];
    pokerState.communityCards = [];
    pokerState.gameActive = true;
    pokerState.gamePhase = 'pre-flop';
    pokerState.pot = 0;
    pokerState.currentBet = 0;
    pokerState.opponent1Fold = false;
    pokerState.opponent2Fold = false;
    
    if (deck.length < 30) {
        deck = createDeck();
    }

    // Deal hole cards
    pokerState.playerHand.push(deck.pop());
    pokerState.playerHand.push(deck.pop());
    
    pokerState.opponent1Hand.push(deck.pop());
    pokerState.opponent1Hand.push(deck.pop());
    
    pokerState.opponent2Hand.push(deck.pop());
    pokerState.opponent2Hand.push(deck.pop());

    // Post blinds
    pokerState.balance -= blind;
    pokerState.opponent1Stack -= blind * 2;
    pokerState.opponent2Stack -= blind;
    pokerState.pot = blind * 4;
    
    document.getElementById('balance').textContent = pokerState.balance;
    document.querySelector('.opponent1-stack').textContent = pokerState.opponent1Stack;
    document.querySelector('.opponent2-stack').textContent = pokerState.opponent2Stack;
    document.getElementById('pot').textContent = pokerState.pot;

    document.getElementById('bettingSection').style.display = 'none';
    document.getElementById('gameControls').style.display = 'flex';
    document.getElementById('resultMessage').innerHTML = '';
    document.getElementById('playAgainControls').style.display = 'none';

    displayCards();
    document.getElementById('handRank').textContent = 'Hole cards dealt';
    updateGameStatus('Your turn - Place your bet or fold.');
}

// Quick bet
function quickBet(amount) {
    document.getElementById('betAmount').value = amount;
    startPokerHand();
}

// All In
function allIn() {
    document.getElementById('betAmount').value = pokerState.balance;
    startPokerHand();
}

// All In during game
function allInPoker() {
    updateGameStatus('You went all in!');
    setTimeout(() => {
        endHand();
    }, 1500);
}

// Fold
function fold() {
    updateGameStatus('You folded. Opponents win the pot!');
    setTimeout(() => {
        endGameRound();
    }, 1000);
}

// Check
function check() {
    updateGameStatus('You checked. Opponent action coming...');
    setTimeout(() => {
        endHand();
    }, 1000);
}

// Call
function call() {
    const callAmount = Math.min(pokerState.balance, Math.abs(pokerState.currentBet));
    pokerState.balance -= callAmount;
    pokerState.pot += callAmount;
    
    document.getElementById('balance').textContent = pokerState.balance;
    document.getElementById('pot').textContent = pokerState.pot;
    
    updateGameStatus('You called. Opponent action coming...');
    setTimeout(() => {
        endHand();
    }, 1000);
}

// Raise
function raise() {
    const raiseAmount = Math.floor(pokerState.pot * 0.5);
    
    if (raiseAmount > pokerState.balance) {
        alert('Insufficient balance to raise');
        return;
    }
    
    pokerState.balance -= raiseAmount;
    pokerState.pot += raiseAmount;
    pokerState.currentBet = raiseAmount;
    
    document.getElementById('balance').textContent = pokerState.balance;
    document.getElementById('pot').textContent = pokerState.pot;
    
    updateGameStatus(`You raised $${raiseAmount}! Opponent action coming...`);
    setTimeout(() => {
        endHand();
    }, 1000);
}

// End hand
function endHand() {
    pokerState.gameActive = false;
    
    // Deal community cards
    if (pokerState.communityCards.length === 0) {
        for (let i = 0; i < 5; i++) {
            pokerState.communityCards.push(deck.pop());
        }
    }
    
    displayCards();
    
    // Determine winner
    let result = 'You won with a strong hand!';
    let resultType = 'win';
    let winnings = pokerState.pot;
    
    if (pokerState.opponent1Fold && pokerState.opponent2Fold) {
        pokerState.balance += winnings;
    } else if (Math.random() < 0.5) {
        pokerState.balance += winnings;
        document.getElementById('resultMessage').className = 'result-message win';
    } else {
        result = 'Opponent won with a better hand.';
        resultType = 'loss';
        document.getElementById('resultMessage').className = 'result-message loss';
    }
    
    document.getElementById('resultMessage').textContent = result;
    document.getElementById('balance').textContent = pokerState.balance;
    addToHistory(resultType, winnings);
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('playAgainControls').style.display = 'flex';
}

// End game round
function endGameRound() {
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('playAgainControls').style.display = 'flex';
}

// Add to history
function addToHistory(resultType, amount) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item ' + resultType;

    const resultText = resultType.charAt(0).toUpperCase() + resultType.slice(1);
    historyItem.textContent = `${resultText}: ${resultType === 'win' ? '+' : '-'}$${amount}`;

    const historyDiv = document.getElementById('history');
    historyDiv.insertBefore(historyItem, historyDiv.firstChild);

    while (historyDiv.children.length > 10) {
        historyDiv.removeChild(historyDiv.lastChild);
    }
}

// Update game status
function updateGameStatus(message) {
    document.getElementById('gameStatus').textContent = message;
}

// Play again
function playAgain() {
    if (pokerState.balance <= 0) {
        alert('Game Over! You\'re out of money. Refresh to restart.');
        return;
    }
    
    document.getElementById('bettingSection').style.display = 'block';
    document.getElementById('playAgainControls').style.display = 'none';
    document.getElementById('resultMessage').innerHTML = '';
    document.getElementById('gameStatus').innerHTML = '';
    document.getElementById('playerCards').innerHTML = '';
    document.getElementById('communityCards').innerHTML = '';
    document.getElementById('handRank').textContent = 'Waiting for cards';
    pokerState.opponent1Fold = false;
    pokerState.opponent2Fold = false;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('balance').textContent = pokerState.balance;
});