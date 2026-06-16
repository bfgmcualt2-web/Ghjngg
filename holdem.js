// Texas Hold'em game state and rules engine
const STARTING_STACK = 1000;
const MIN_BLIND = 10;
const RAISE_SIZE = 50;

const pokerState = {
    balance: STARTING_STACK,
    pot: 0,
    currentBet: 0,
    playerContribution: 0,
    playerHand: [],
    communityCards: [],
    gameActive: false,
    gamePhase: 'waiting',
    opponent1Stack: STARTING_STACK,
    opponent2Stack: STARTING_STACK,
    opponent1Hand: [],
    opponent2Hand: [],
    opponent1Fold: false,
    opponent2Fold: false,
    history: []
};

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const rankValues = Object.fromEntries(ranks.map((rank, index) => [rank, index + 2]));
const handNames = [
    'High Card',
    'One Pair',
    'Two Pair',
    'Three of a Kind',
    'Straight',
    'Flush',
    'Full House',
    'Four of a Kind',
    'Straight Flush'
];

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit });
        }
    }
    return shuffle(deck);
}

function shuffle(cards) {
    const shuffled = [...cards];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
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

function startPokerHand() {
    const blind = parseInt(document.getElementById('betAmount').value, 10);

    if (Number.isNaN(blind) || blind < MIN_BLIND) {
        alert(`Minimum blind is $${MIN_BLIND}`);
        return;
    }

    if (blind > pokerState.balance) {
        alert('Insufficient balance');
        return;
    }

    if (deck.length < 20) deck = createDeck();

    pokerState.playerHand = [deck.pop(), deck.pop()];
    pokerState.opponent1Hand = [deck.pop(), deck.pop()];
    pokerState.opponent2Hand = [deck.pop(), deck.pop()];
    pokerState.communityCards = [];
    pokerState.gameActive = true;
    pokerState.gamePhase = 'pre-flop';
    pokerState.pot = 0;
    pokerState.currentBet = blind;
    pokerState.playerContribution = blind;
    pokerState.opponent1Fold = false;
    pokerState.opponent2Fold = false;

    takeChips('player', blind);
    takeChips('opponent1', Math.min(blind, pokerState.opponent1Stack));
    takeChips('opponent2', Math.min(blind, pokerState.opponent2Stack));

    document.getElementById('bettingSection').style.display = 'none';
    document.getElementById('gameControls').style.display = 'flex';
    document.getElementById('playAgainControls').style.display = 'none';
    document.getElementById('resultMessage').textContent = '';
    document.getElementById('resultMessage').className = 'result-message';

    updateStacks();
    displayOpponentCards(false);
    displayCards();
    document.getElementById('handRank').textContent = 'Hole cards dealt';
    updateGameStatus('Your turn - Place your bet or fold.');
}

function quickBet(amount) {
    document.getElementById('betAmount').value = amount;
    startPokerHand();
}

function allIn() {
    document.getElementById('betAmount').value = pokerState.balance;
    startPokerHand();
}

function allInPoker() {
    if (!pokerState.gameActive) return;
    const amount = pokerState.balance;
    if (amount <= 0) return;
    takeChips('player', amount);
    pokerState.playerContribution += amount;
    pokerState.currentBet = Math.max(pokerState.currentBet, pokerState.playerContribution);
    opponentActions(true);
    updateStacks();
    updateGameStatus('You moved all in. Running out the board...');
    finishBoardAndShowdown();
}

function fold() {
    if (!pokerState.gameActive) return;
    pokerState.gameActive = false;
    const winner = pokerState.opponent1Fold ? 'opponent2' : 'opponent1';
    awardPot(winner);
    finishHand(`You folded. ${winner === 'opponent1' ? 'Opponent 1' : 'Opponent 2'} wins the pot.`, 'loss');
}

function check() {
    if (!pokerState.gameActive) return;
    opponentActions(false);
    advanceStreetOrShowdown('You checked.');
}

function call() {
    if (!pokerState.gameActive) return;
    const callAmount = Math.min(pokerState.balance, Math.max(0, pokerState.currentBet - pokerState.playerContribution));
    takeChips('player', callAmount);
    pokerState.playerContribution += callAmount;
    opponentActions(false);
    updateStacks();
    advanceStreetOrShowdown(`You called $${callAmount}.`);
}

function raise() {
    if (!pokerState.gameActive) return;
    const raiseAmount = Math.min(pokerState.balance, RAISE_SIZE);
    if (raiseAmount <= 0) {
        alert('No chips available to raise');
        return;
    }
    takeChips('player', raiseAmount);
    pokerState.playerContribution += raiseAmount;
    pokerState.currentBet = pokerState.playerContribution;
    opponentActions(true);
    updateStacks();
    advanceStreetOrShowdown(`You raised $${raiseAmount}.`);
}

function opponentActions(facingRaise) {
    ['opponent1', 'opponent2'].forEach((opponent) => {
        const foldKey = `${opponent}Fold`;
        if (pokerState[foldKey]) return;

        const handKey = `${opponent}Hand`;
        const stackKey = `${opponent}Stack`;
        const strength = estimateStrength([...pokerState[handKey], ...pokerState.communityCards]);
        const shouldFold = facingRaise && strength < 2 && Math.random() < 0.38;

        if (shouldFold) {
            pokerState[foldKey] = true;
            return;
        }

        const callAmount = Math.min(pokerState[stackKey], facingRaise ? RAISE_SIZE : Math.ceil(pokerState.currentBet / 2));
        takeChips(opponent, callAmount);
    });
}

function advanceStreetOrShowdown(prefix) {
    if (activeOpponentCount() === 0) {
        pokerState.gameActive = false;
        awardPot('player');
        finishHand(`${prefix} Both opponents folded. You win the pot!`, 'win');
        return;
    }

    if (pokerState.gamePhase === 'river') {
        showdown(prefix);
        return;
    }

    dealNextStreet();
    updateStacks();
    displayCards();
    updateGameStatus(`${prefix} ${phaseLabel()} is on the table. Your action.`);
}

function dealNextStreet() {
    if (pokerState.gamePhase === 'pre-flop') {
        burnCard();
        pokerState.communityCards.push(deck.pop(), deck.pop(), deck.pop());
        pokerState.gamePhase = 'flop';
        return;
    }

    if (pokerState.gamePhase === 'flop') {
        burnCard();
        pokerState.communityCards.push(deck.pop());
        pokerState.gamePhase = 'turn';
        return;
    }

    if (pokerState.gamePhase === 'turn') {
        burnCard();
        pokerState.communityCards.push(deck.pop());
        pokerState.gamePhase = 'river';
    }
}

function burnCard() {
    deck.pop();
}

function finishBoardAndShowdown() {
    while (pokerState.communityCards.length < 5) {
        dealNextStreet();
    }
    displayCards();
    setTimeout(() => showdown('All cards are out.'), 500);
}

function showdown(prefix = 'Showdown.') {
    pokerState.gameActive = false;
    while (pokerState.communityCards.length < 5) dealNextStreet();
    displayCards();
    displayOpponentCards(true);

    const contenders = [
        { id: 'player', name: 'You', hand: pokerState.playerHand, folded: false },
        { id: 'opponent1', name: 'Opponent 1', hand: pokerState.opponent1Hand, folded: pokerState.opponent1Fold },
        { id: 'opponent2', name: 'Opponent 2', hand: pokerState.opponent2Hand, folded: pokerState.opponent2Fold }
    ].filter((player) => !player.folded);

    const scored = contenders.map((player) => ({
        ...player,
        score: evaluateBestHand([...player.hand, ...pokerState.communityCards])
    })).sort((a, b) => compareScores(b.score, a.score));

    const best = scored[0];
    const tied = scored.filter((player) => compareScores(player.score, best.score) === 0);
    const potShare = Math.floor(pokerState.pot / tied.length);
    tied.forEach((player) => awardAmount(player.id, potShare));
    pokerState.pot = 0;

    const playerScore = scored.find((player) => player.id === 'player')?.score;
    const playerText = playerScore ? `${playerScore.name} (${formatKickers(playerScore.values)})` : 'Folded';
    const resultType = tied.some((player) => player.id === 'player') ? 'win' : 'loss';
    const winnerText = tied.map((player) => player.name).join(' and ');

    finishHand(`${prefix} ${winnerText} won with ${best.score.name}. Your hand: ${playerText}.`, resultType);
}

function awardPot(player) {
    awardAmount(player, pokerState.pot);
    pokerState.pot = 0;
    updateStacks();
}

function awardAmount(player, amount) {
    if (player === 'player') pokerState.balance += amount;
    if (player === 'opponent1') pokerState.opponent1Stack += amount;
    if (player === 'opponent2') pokerState.opponent2Stack += amount;
}

function finishHand(message, resultType) {
    pokerState.gameActive = false;
    updateStacks();
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('playAgainControls').style.display = 'flex';
    const resultMessage = document.getElementById('resultMessage');
    resultMessage.textContent = message;
    resultMessage.className = `result-message ${resultType}`;
    updateGameStatus('Hand complete. Start another hand when ready.');
    addToHistory(resultType, message);
}

function activeOpponentCount() {
    return Number(!pokerState.opponent1Fold) + Number(!pokerState.opponent2Fold);
}

function phaseLabel() {
    return ({ flop: 'The flop', turn: 'The turn', river: 'The river' })[pokerState.gamePhase] || 'The next street';
}

function estimateStrength(cards) {
    if (cards.length < 5) {
        const values = cards.map((card) => rankValues[card.rank]);
        const pairs = values.length - new Set(values).size;
        const high = Math.max(...values);
        return pairs + (high >= 12 ? 1 : 0);
    }
    return evaluateBestHand(cards).category;
}

function evaluateBestHand(cards) {
    const combinations = getCombinations(cards, 5);
    return combinations
        .map(evaluateFiveCards)
        .sort((a, b) => compareScores(b, a))[0];
}

function evaluateFiveCards(cards) {
    const values = cards.map((card) => rankValues[card.rank]).sort((a, b) => b - a);
    const counts = countBy(values);
    const groups = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || b.value - a.value);
    const isFlush = cards.every((card) => card.suit === cards[0].suit);
    const straightHigh = getStraightHigh(values);

    if (isFlush && straightHigh) return score(8, [straightHigh]);
    if (groups[0].count === 4) return score(7, [groups[0].value, highestExcept(values, [groups[0].value])[0]]);
    if (groups[0].count === 3 && groups[1]?.count === 2) return score(6, [groups[0].value, groups[1].value]);
    if (isFlush) return score(5, values);
    if (straightHigh) return score(4, [straightHigh]);
    if (groups[0].count === 3) return score(3, [groups[0].value, ...highestExcept(values, [groups[0].value]).slice(0, 2)]);
    if (groups[0].count === 2 && groups[1]?.count === 2) {
        const pairs = groups.filter((group) => group.count === 2).map((group) => group.value).sort((a, b) => b - a);
        return score(2, [...pairs, highestExcept(values, pairs)[0]]);
    }
    if (groups[0].count === 2) return score(1, [groups[0].value, ...highestExcept(values, [groups[0].value]).slice(0, 3)]);
    return score(0, values);
}

function score(category, values) {
    return { category, values, name: handNames[category] };
}

function compareScores(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    for (let index = 0; index < Math.max(a.values.length, b.values.length); index++) {
        const difference = (a.values[index] || 0) - (b.values[index] || 0);
        if (difference !== 0) return difference;
    }
    return 0;
}

function getStraightHigh(values) {
    const unique = [...new Set(values)].sort((a, b) => b - a);
    if (unique.includes(14)) unique.push(1);
    for (let index = 0; index <= unique.length - 5; index++) {
        const window = unique.slice(index, index + 5);
        if (window[0] - window[4] === 4) return window[0];
    }
    return null;
}

function highestExcept(values, excluded) {
    return values.filter((value) => !excluded.includes(value));
}

function countBy(values) {
    return values.reduce((counts, value) => counts.set(value, (counts.get(value) || 0) + 1), new Map());
}

function getCombinations(items, size) {
    const results = [];
    function visit(start, combo) {
        if (combo.length === size) {
            results.push(combo);
            return;
        }
        for (let index = start; index <= items.length - (size - combo.length); index++) {
            visit(index + 1, [...combo, items[index]]);
        }
    }
    visit(0, []);
    return results;
}

function formatKickers(values) {
    return values.map((value) => Object.keys(rankValues).find((rank) => rankValues[rank] === value) || value).join(', ');
}

function updateHandRank() {
    const handRank = document.getElementById('handRank');
    if (pokerState.playerHand.length === 0) {
        handRank.textContent = 'Waiting for cards';
        return;
    }
    if (pokerState.communityCards.length < 3) {
        handRank.textContent = 'Hole cards dealt';
        return;
    }
    const evaluated = evaluateBestHand([...pokerState.playerHand, ...pokerState.communityCards]);
    handRank.textContent = evaluated.name;
}

function addToHistory(resultType, message) {
    const historyItem = document.createElement('div');
    historyItem.className = `history-item ${resultType}`;
    historyItem.textContent = message;

    const historyDiv = document.getElementById('history');
    historyDiv.insertBefore(historyItem, historyDiv.firstChild);

    while (historyDiv.children.length > 10) historyDiv.removeChild(historyDiv.lastChild);
}

function updateGameStatus(message) {
    document.getElementById('gameStatus').textContent = message;
}

function playAgain() {
    if (pokerState.balance <= 0) {
        alert('Game Over! You are out of money. Refresh to restart.');
        return;
    }

    document.getElementById('bettingSection').style.display = 'block';
    document.getElementById('playAgainControls').style.display = 'none';
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('resultMessage').textContent = '';
    document.getElementById('resultMessage').className = 'result-message';
    document.getElementById('playerCards').innerHTML = '';
    document.getElementById('communityCards').innerHTML = '';
    document.getElementById('handRank').textContent = 'Waiting for cards';
    pokerState.opponent1Fold = false;
    pokerState.opponent2Fold = false;
}

document.addEventListener('DOMContentLoaded', () => {
    updateStacks();
    updateGameStatus('Set your blind to start a new hand.');
});
