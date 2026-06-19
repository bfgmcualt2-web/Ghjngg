const arcadeGames = [
    { id: 'slots', icon: '🎰', name: 'Lucky Slots', detail: 'Match symbols for a big multiplier.', bet: 25, winChance: 0.34, winText: 'Triple cherries hit the payline!' },
    { id: 'roulette', icon: '🔴', name: 'Roulette Rush', detail: 'Pick red or black and watch the wheel.', bet: 50, winChance: 0.48, winText: 'The ball landed on your color.' },
    { id: 'dice', icon: '🎲', name: 'High Roller Dice', detail: 'Roll 8 or higher to win.', bet: 30, winChance: 0.42, winText: 'The dice came up hot.' },
    { id: 'coin', icon: '🪙', name: 'Double Coin Flip', detail: 'Call the coin and double up.', bet: 20, winChance: 0.5, winText: 'Heads up, you called it.' },
    { id: 'wheel', icon: '🎡', name: 'Prize Wheel', detail: 'Spin for bonus wedges.', bet: 40, winChance: 0.38, winText: 'The wheel stopped on a prize wedge.' },
    { id: 'higher', icon: '🂡', name: 'Higher or Lower', detail: 'Beat the dealer card.', bet: 35, winChance: 0.46, winText: 'Your card outranked the house.' },
    { id: 'scratch', icon: '💎', name: 'Scratch Ticket', detail: 'Reveal three gems to win.', bet: 15, winChance: 0.29, winText: 'Three gems scratched clean.' },
    { id: 'keno', icon: '✨', name: 'Keno Burst', detail: 'Hit enough lucky numbers.', bet: 25, winChance: 0.32, winText: 'Your numbers lit up the board.' },
    { id: 'plinko', icon: '🔻', name: 'Plinko Drop', detail: 'Drop the chip into a payout slot.', bet: 45, winChance: 0.4, winText: 'The chip bounced into a payout lane.' },
    { id: 'baccarat', icon: '🎴', name: 'Mini Baccarat', detail: 'Player hand beats banker.', bet: 50, winChance: 0.45, winText: 'Player hand wins the coup.' }
];

let arcadeBalance = 1000;

function renderArcade() {
    document.getElementById('arcadeGrid').innerHTML = arcadeGames.map((game) => `
        <article class="arcade-card" id="${game.id}">
            <div class="game-heading">
                <div class="game-icon">${game.icon}</div>
                <div>
                    <h2>${game.name}</h2>
                    <div class="stake">Stake: $${game.bet}</div>
                </div>
            </div>
            <div class="game-visual" id="visual-${game.id}" aria-label="${game.name} visual result">
                ${getIdleVisual(game.id)}
            </div>
            <p>${game.detail}</p>
            <button type="button" onclick="playArcadeGame('${game.id}')">Play ${game.name}</button>
            <div class="game-result" aria-live="polite">Press play to see the action.</div>
        </article>
    `).join('');
}

function playArcadeGame(gameId) {
    const game = arcadeGames.find((entry) => entry.id === gameId);
    if (!game || arcadeBalance < game.bet) {
        updateArcadeHistory('Not enough arcade bankroll for that game.', 'loss');
        return;
    }

    arcadeBalance -= game.bet;
    const won = Math.random() < game.winChance;
    const multiplier = won ? (Math.floor(Math.random() * 3) + 2) : 0;
    const payout = game.bet * multiplier;
    arcadeBalance += payout;
    document.getElementById('arcadeBalance').textContent = arcadeBalance;

    const message = won ? `${game.winText} You won $${payout - game.bet}!` : `${game.name} missed. You lost $${game.bet}.`;
    const resultCard = document.querySelector(`#${game.id} .game-result`);
    resultCard.textContent = message;
    resultCard.className = `game-result ${won ? 'win' : 'loss'}`;

    const visualCard = document.getElementById(`visual-${game.id}`);
    visualCard.innerHTML = getResultVisual(game.id, won);
    visualCard.className = `game-visual ${won ? 'win' : 'loss'} animate`;
    setTimeout(() => visualCard.classList.remove('animate'), 550);

    updateArcadeHistory(`${game.icon} ${message}`, won ? 'win' : 'loss');
}

function getIdleVisual(gameId) {
    const visuals = {
        slots: reelVisual(['🍒', '7️⃣', '🍋']),
        roulette: rouletteVisual('?', 'Spin'),
        dice: diceVisual([1, 2]),
        coin: coinVisual(['?', '?']),
        wheel: wheelVisual('Prize'),
        higher: cardBattleVisual('A♠', 'K♥'),
        scratch: scratchVisual(['?', '?', '?']),
        keno: kenoVisual([3, 8, 12], []),
        plinko: plinkoVisual(2),
        baccarat: baccaratVisual(['A♣', '6♦'], ['K♠', '4♥'])
    };
    return visuals[gameId] || '';
}

function getResultVisual(gameId, won) {
    const visualFactories = {
        slots: () => reelVisual(won ? ['💎', '💎', '💎'] : shuffle(['🍒', '🍋', '🔔', '7️⃣']).slice(0, 3)),
        roulette: () => rouletteVisual(won ? 'RED' : 'BLACK', won ? 'Winner' : 'Miss'),
        dice: () => diceVisual(won ? [6, randomInt(2, 6)] : [1, randomInt(1, 5)]),
        coin: () => coinVisual(won ? ['HEADS', 'HEADS'] : ['HEADS', 'TAILS']),
        wheel: () => wheelVisual(won ? 'JACKPOT' : 'TRY AGAIN'),
        higher: () => cardBattleVisual(won ? 'A♠' : '4♣', won ? '9♥' : 'Q♦'),
        scratch: () => scratchVisual(won ? ['💎', '💎', '💎'] : ['💎', '🍀', '⭐']),
        keno: () => kenoVisual(won ? [7, 13, 21, 32, 44] : [2, 9, 18, 35, 49], won ? [7, 13, 21] : [9]),
        plinko: () => plinkoVisual(won ? 4 : 1),
        baccarat: () => baccaratVisual(won ? ['9♣', 'K♦'] : ['2♣', '5♦'], won ? ['3♠', '4♥'] : ['8♠', 'Q♥'])
    };
    return visualFactories[gameId]?.() || '';
}

function reelVisual(symbols) {
    return `<div class="slot-reels">${symbols.map((symbol) => `<span>${symbol}</span>`).join('')}</div>`;
}

function rouletteVisual(value, label) {
    return `<div class="roulette-wheel"><span>${value}</span></div><strong>${label}</strong>`;
}

function diceVisual(values) {
    return `<div class="dice-row">${values.map((value) => `<span class="die">${value}</span>`).join('')}</div>`;
}

function coinVisual(values) {
    return `<div class="coin-row">${values.map((value) => `<span class="coin-face">${value}</span>`).join('')}</div>`;
}

function wheelVisual(label) {
    return `<div class="prize-wheel"><span>${label}</span></div>`;
}

function cardBattleVisual(playerCard, houseCard) {
    return `<div class="card-battle"><span>${playerCard}</span><em>vs</em><span>${houseCard}</span></div>`;
}

function scratchVisual(symbols) {
    return `<div class="scratch-row">${symbols.map((symbol) => `<span>${symbol}</span>`).join('')}</div>`;
}

function kenoVisual(numbers, hits) {
    return `<div class="keno-board">${numbers.map((number) => `<span class="${hits.includes(number) ? 'hit' : ''}">${number}</span>`).join('')}</div>`;
}

function plinkoVisual(slot) {
    return `<div class="plinko-board"><span>●</span><div>${[1, 2, 3, 4, 5].map((value) => `<b class="${value === slot ? 'hit' : ''}">${value}x</b>`).join('')}</div></div>`;
}

function baccaratVisual(playerCards, bankerCards) {
    return `<div class="baccarat-table"><div><small>Player</small>${playerCards.map((card) => `<span>${card}</span>`).join('')}</div><div><small>Banker</small>${bankerCards.map((card) => `<span>${card}</span>`).join('')}</div></div>`;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

function updateArcadeHistory(message, result) {
    const item = document.createElement('div');
    item.className = `history-item ${result}`;
    item.textContent = message;
    const history = document.getElementById('arcadeHistory');
    history.insertBefore(item, history.firstChild);
    while (history.children.length > 12) history.removeChild(history.lastChild);
}

document.addEventListener('DOMContentLoaded', renderArcade);
