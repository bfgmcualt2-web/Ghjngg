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
            <div class="game-icon">${game.icon}</div>
            <h2>${game.name}</h2>
            <p>${game.detail}</p>
            <div class="stake">Stake: $${game.bet}</div>
            <button type="button" onclick="playArcadeGame('${game.id}')">Play ${game.name}</button>
            <div class="game-result" aria-live="polite"></div>
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
    const card = document.querySelector(`#${game.id} .game-result`);
    card.textContent = message;
    card.className = `game-result ${won ? 'win' : 'loss'}`;
    updateArcadeHistory(`${game.icon} ${message}`, won ? 'win' : 'loss');
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
