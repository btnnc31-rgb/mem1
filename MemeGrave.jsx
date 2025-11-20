import React, { useState, useEffect } from 'react';
import {
  Skull,
  Wifi,
  WifiOff,
  AlertCircle,
  TrendingDown,
  Award,
  Users,
  Twitter,
  MessageCircle,
  Download,
  BarChart3
} from 'lucide-react';

/**
 * MemeGrave.jsx
 * Refactored frontend mock for MemeGrave project.
 * Notes:
 *  - This is a frontend-only mock that simulates deposits and draws using localStorage.
 *  - In production you MUST use a smart contract for transfers/burns and a secure randomness source (Chainlink VRF or backend+auditable RNG).
 */

// ============= ANALYTICS TRACKING =============
const Analytics = {
  init: () => {
    Analytics.track('page_view', { page: 'home' });
  },
  track: (eventName, data = {}) => {
    try {
      const event = {
        event: eventName,
        timestamp: Date.now(),
        user: localStorage.getItem('userAddress') || 'anonymous',
        ...data
      };

      // Persist last 100 events
      const events = JSON.parse(localStorage.getItem('analytics') || '[]');
      events.push(event);
      localStorage.setItem('analytics', JSON.stringify(events.slice(-100)));
      // Console for dev:
      console.log('Analytics:', eventName, data);
      // In production send to analytics backend
      // fetch('/analytics', { method: 'POST', body: JSON.stringify(event) })
    } catch (err) {
      console.error('Analytics error:', err);
    }
  },
  getStats: () => {
    const events = JSON.parse(localStorage.getItem('analytics') || '[]');
    return {
      totalEvents: events.length,
      uniqueUsers: [...new Set(events.map(e => e.user))].length,
      eventCounts: events.reduce((acc, e) => {
        acc[e.event] = (acc[e.event] || 0) + 1;
        return acc;
      }, {})
    };
  }
};

// ============= BACKEND API MOCK =============
const BackendAPI = {
  baseURL: 'https://api.memegrave.io', // Replace with your backend URL

  // Get global stats from localStorage (mock)
  getGlobalStats: async () => {
    try {
      Analytics.track('api_call', { endpoint: 'getGlobalStats' });
      const stats = {
        prizePool: parseFloat(localStorage.getItem('mg_prizePool') || '0'),
        ecosystemFund: parseFloat(localStorage.getItem('mg_ecosystemFund') || '0'),
        developerFund: parseFloat(localStorage.getItem('mg_developerFund') || '0'),
        revivalFund: parseFloat(localStorage.getItem('mg_revivalFund') || '0'),
        totalEntries: JSON.parse(localStorage.getItem('mg_entries') || '[]').length,
        lastWinner: JSON.parse(localStorage.getItem('mg_lastWinner') || 'null')
      };
      return stats;
    } catch (err) {
      console.error('BackendAPI.getGlobalStats error', err);
      return null;
    }
  },

  // Submit entry (mock): in production this should be an authenticated call to record on backend & be backed by a chain transfer or contract event
  submitEntry: async (entryData) => {
    try {
      Analytics.track('api_call', { endpoint: 'submitEntry', value: entryData.value });
      const entries = JSON.parse(localStorage.getItem('mg_entries') || '[]');
      entries.push(entryData);
      localStorage.setItem('mg_entries', JSON.stringify(entries));

      // Distribute funds according to project split:
      // 50% prizePool, 30% ecosystemDev, 10% developer, 10% revival fund
      const deposit = Number(entryData.value);
      const toPrize = deposit * 0.5;
      const toEcosystem = deposit * 0.3;
      const toDeveloper = deposit * 0.1;
      const toRevival = deposit * 0.1;

      const prizePool = parseFloat(localStorage.getItem('mg_prizePool') || '0') + toPrize;
      const ecosystemFund = parseFloat(localStorage.getItem('mg_ecosystemFund') || '0') + toEcosystem;
      const developerFund = parseFloat(localStorage.getItem('mg_developerFund') || '0') + toDeveloper;
      const revivalFund = parseFloat(localStorage.getItem('mg_revivalFund') || '0') + toRevival;

      localStorage.setItem('mg_prizePool', prizePool.toString());
      localStorage.setItem('mg_ecosystemFund', ecosystemFund.toString());
      localStorage.setItem('mg_developerFund', developerFund.toString());
      localStorage.setItem('mg_revivalFund', revivalFund.toString());

      return { success: true };
    } catch (err) {
      console.error('submitEntry error:', err);
      return { success: false, error: err.message || String(err) };
    }
  },

  // Get dead graves (query dexscreener mock)
  getDeadGraves: async () => {
    try {
      Analytics.track('api_call', { endpoint: 'getDeadGraves' });
      const res = await fetch('https://api.dexscreener.com/latest/dex/search/?q=bsc');
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Get graves error:', err);
      return null;
    }
  },

  // Execute draw (mock) - In production: server/contract must do this and return verifiable winner
  executeDraw: async () => {
    try {
      Analytics.track('api_call', { endpoint: 'executeDraw' });
      const entries = JSON.parse(localStorage.getItem('mg_entries') || '[]');
      if (!entries || entries.length === 0) return { success: false, error: 'No entries' };

      // Simple pseudo-random selection (INSECURE) - replace with verifiable RNG in prod
      const winner = entries[Math.floor(Math.random() * entries.length)];
      localStorage.setItem('mg_lastWinner', JSON.stringify(winner));

      // Move prizePool out to winner payout (mock)
      const prizePool = parseFloat(localStorage.getItem('mg_prizePool') || '0');
      return { success: true, winner, prizePool };
    } catch (err) {
      console.error('Draw error:', err);
      return { success: false, error: err.message || String(err) };
    }
  },

  // Save social auth (mock)
  saveSocialAuth: async (provider, userData) => {
    try {
      Analytics.track('social_auth', { provider });
      localStorage.setItem(`social_${provider}`, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      console.error('Social auth error:', err);
      return { success: false };
    }
  }
};

// ============= SOCIAL AUTH (mocked) =============
const SocialAuth = {
  mockLogin: (provider) => {
    const mockUser = {
      id: Math.random().toString(36).substring(2),
      username: `${provider}_user_${Math.floor(Math.random() * 1000)}`,
      provider,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${provider}`
    };
    localStorage.setItem(`${provider}_user`, JSON.stringify(mockUser));
    Analytics.track('auth_success', { provider, mock: true });
    return mockUser;
  }
};

// ============= PWA INSTALLATION =============
const PWAInstaller = {
  prompt: null,
  init: () => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      PWAInstaller.prompt = e;
      Analytics.track('pwa_prompt_available');
    });
  },
  install: async () => {
    if (!PWAInstaller.prompt) {
      Analytics.track('pwa_install_failed', { reason: 'no_prompt' });
      return false;
    }
    PWAInstaller.prompt.prompt();
    const result = await PWAInstaller.prompt.userChoice;
    Analytics.track('pwa_install_result', { outcome: result.outcome });
    if (result.outcome === 'accepted') {
      PWAInstaller.prompt = null;
      return true;
    }
    return false;
  }
};

// Utility functions
const utils = {
  shortAddr: (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  },
  formatUSD: (val) => {
    const n = Number(val || 0);
    return `$${n.toFixed(2)}`;
  },
  isValidBSC: (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
  escapeHtml: (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  vibrate: (ms = 200) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  }
};

const epitaphs = [
  'Here lies {name} — rugged faster than a dev\'s promise.',
  '{name} didn\'t die. It was murdered by liquidity.',
  'RIP {name} — survived 3 hours. A legend.',
  'Gone but not forgotten… unless the chart says otherwise.',
  '{name} tried to moon. Gravity won.',
  'Died of natural causes: 99% sell pressure.',
  'Beloved by 12 holders. Hated by the chart.',
  'It wasn\'t a rug. It was a "strategic exit".',
  'Once a king. Now a ghost in the mempool.',
  'F in chat for {name} — pressed too many times.'
];

const generateEpitaph = (name) => {
  const template = epitaphs[Math.floor(Math.random() * epitaphs.length)];
  return template.replace(/\{name\}/g, name || 'Anon Meme');
};

export default function MemeGrave() {
  const [theme, setTheme] = useState(localStorage.getItem('mg_theme') || 'default');
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(localStorage.getItem('userAddress') || '');
  const [prizePool, setPrizePool] = useState(parseFloat(localStorage.getItem('mg_prizePool') || '0'));
  const [ecosystemFund, setEcosystemFund] = useState(parseFloat(localStorage.getItem('mg_ecosystemFund') || '0'));
  const [developerFund, setDeveloperFund] = useState(parseFloat(localStorage.getItem('mg_developerFund') || '0'));
  const [revivalFund, setRevivalFund] = useState(parseFloat(localStorage.getItem('mg_revivalFund') || '0'));
  const [entries, setEntries] = useState(JSON.parse(localStorage.getItem('mg_entries') || '[]'));
  const [deadGraves, setDeadGraves] = useState([]);
  const [buriedGraves, setBuriedGraves] = useState(JSON.parse(localStorage.getItem('mg_buriedGraves') || '[]'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('mg_onboardingSeen'));
  const [lastScan, setLastScan] = useState(0);
  const [showBuryForm, setShowBuryForm] = useState(false);
  const [buryCA, setBuryCA] = useState('');
  const [buryName, setBuryName] = useState('');
  const [toast, setToast] = useState(null);
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [socialUser, setSocialUser] = useState(null);

  const SCAN_COOLDOWN = 30000; // 30s cooldown
  const MIN_DEPOSIT_USD = 5.0; // Minimum 5 USD worth

  useEffect(() => {
    Analytics.init();
    PWAInstaller.init();
    loadGlobalStats();

    const twitterUser = localStorage.getItem('twitter_user');
    const discordUser = localStorage.getItem('discord_user');
    if (twitterUser) setSocialUser(JSON.parse(twitterUser));
    else if (discordUser) setSocialUser(JSON.parse(discordUser));

    if (buriedGraves.length > 100) {
      const cleaned = buriedGraves.slice(0, 50);
      setBuriedGraves(cleaned);
      localStorage.setItem('mg_buriedGraves', JSON.stringify(cleaned));
    }

    // Check if PWA prompt is available after 5s
    setTimeout(() => {
      if (PWAInstaller.prompt && !localStorage.getItem('mg_pwa_prompted')) {
        setShowPWAPrompt(true);
        localStorage.setItem('mg_pwa_prompted', 'true');
      }
    }, 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGlobalStats = async () => {
    const stats = await BackendAPI.getGlobalStats();
    if (stats) {
      setPrizePool(stats.prizePool);
      setEcosystemFund(stats.ecosystemFund);
      setDeveloperFund(stats.developerFund);
      setRevivalFund(stats.revivalFund);
      setEntries(JSON.parse(localStorage.getItem('mg_entries') || '[]'));
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'default' ? 'zombie' : 'default';
    setTheme(newTheme);
    localStorage.setItem('mg_theme', newTheme);
    Analytics.track('theme_changed', { theme: newTheme });
  };

  // Wallet connect: simplified request; replace with ethers.js for production
  const connectWallet = async () => {
    try {
      setLoading(true);
      setError('');
      Analytics.track('wallet_connect_attempt');

      if (window.ethereum) {
        // Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts && accounts[0];
        if (!account) {
          throw new Error('No account returned');
        }

        // Ensure on BSC chain (chainId 0x38)
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== '0x38') {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x38' }] // 56 decimal
            });
          } catch (switchError) {
            // If user hasn't added BSC, prompt them
            if (switchError.code === 4902) {
              setError('Please add BSC network to your wallet (Chain ID: 56)');
              Analytics.track('wallet_connect_failed', { reason: 'missing_bsc' });
              return;
            }
            throw switchError;
          }
        }

        setAddress(account);
        setConnected(true);
        localStorage.setItem('userAddress', account);
        showToast('Connected to BSC!');
        utils.vibrate();
        Analytics.track('wallet_connected', { address: account.slice(0, 10) });

        // Optional: subscribe to account / chain changes
        window.ethereum.on && window.ethereum.on('accountsChanged', (accs) => {
          if (!accs || accs.length === 0) {
            setConnected(false);
            setAddress('');
            localStorage.removeItem('userAddress');
          } else {
            setAddress(accs[0]);
            localStorage.setItem('userAddress', accs[0]);
          }
        });
        window.ethereum.on && window.ethereum.on('chainChanged', (_chainId) => {
          // Refresh page or handle changes gracefully
          window.location.reload();
        });
      } else {
        setError('No wallet detected. Install MetaMask or Trust Wallet.');
        Analytics.track('wallet_connect_failed', { reason: 'no_wallet' });
      }
    } catch (err) {
      setError(err.message || 'Connection failed');
      Analytics.track('wallet_connect_failed', { error: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const scanGraveyard = async () => {
    const now = Date.now();
    if (now - lastScan < SCAN_COOLDOWN) {
      const waitTime = Math.ceil((SCAN_COOLDOWN - (now - lastScan)) / 1000);
      showToast(`Wait ${waitTime}s before scanning again`, 'warning');
      return;
    }

    const cached = localStorage.getItem('mg_cachedGraves');
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (now - timestamp < 300000) {
          setDeadGraves(data);
          showToast('Loaded from cache', 'info');
          Analytics.track('scan_cached');
          setLastScan(now);
          return;
        }
      } catch {
        // ignore malformed cache
      }
    }

    setLoading(true);
    setError('');
    setLastScan(now);
    Analytics.track('scan_started');

    try {
      const data = await BackendAPI.getDeadGraves();
      const pairs = (data && data.pairs) || [];

      // Filter criteria for "dead" memes and sort by liquidity ascending
      const deadPairs = pairs
        .filter((p) => {
          try {
            return (
              String(p.chainId).toLowerCase() === 'bsc' &&
              Number(p.liquidity?.usd || 0) < 5000 &&
              Number(p.volume?.h1 || 0) < 1000 &&
              !!p.baseToken?.symbol
            );
          } catch {
            return false;
          }
        })
        .slice(0, 50)
        .sort((a, b) => {
          const aL = Number(a.liquidity?.usd || 0);
          const bL = Number(b.liquidity?.usd || 0);
          return aL - bL;
        })
        .slice(0, 10);

      if (deadPairs.length === 0) {
        showToast('No dead memes found. Market is alive!', 'warning');
        setDeadGraves([]);
        Analytics.track('scan_completed', { found: 0 });
        return;
      }

      setDeadGraves(deadPairs);
      localStorage.setItem('mg_cachedGraves', JSON.stringify({ data: deadPairs, timestamp: now }));
      showToast(`Found ${deadPairs.length} dead memes!`);
      utils.vibrate();
      Analytics.track('scan_completed', { found: deadPairs.length });
    } catch (err) {
      setError('Scan failed. API may be rate-limited. Try again in 1 minute.');
      console.error('Scan error:', err);
      Analytics.track('scan_failed', { error: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const deposit = async (tokenAddr, symbol, tokenUsdValue) => {
    // tokenUsdValue: estimated USD value the user is depositing (frontend estimation)
    if (!connected) {
      showToast('Connect wallet first!', 'error');
      return;
    }

    // Validate minimum
    const usd = Number(tokenUsdValue || 0);
    if (usd < MIN_DEPOSIT_USD) {
      showToast(`Minimum deposit is ${utils.formatUSD(MIN_DEPOSIT_USD)}`, 'warning');
      return;
    }

    // In production, you MUST perform an on-chain transfer to a contract which automatically splits funds
    // For this mock, entry.value = usd (we store USD-equivalent for simplicity)
    const entryValue = usd;
    const newEntry = {
      token: tokenAddr,
      symbol,
      user: address,
      value: entryValue,
      ts: Date.now()
    };

    const result = await BackendAPI.submitEntry(newEntry);
    if (result.success) {
      const newEntries = [...entries, newEntry];
      setEntries(newEntries);
      localStorage.setItem('mg_entries', JSON.stringify(newEntries));

      // Update local state pools
      const newPrize = parseFloat(localStorage.getItem('mg_prizePool') || '0');
      const newEco = parseFloat(localStorage.getItem('mg_ecosystemFund') || '0');
      const newDev = parseFloat(localStorage.getItem('mg_developerFund') || '0');
      const newRev = parseFloat(localStorage.getItem('mg_revivalFund') || '0');

      setPrizePool(newPrize);
      setEcosystemFund(newEco);
      setDeveloperFund(newDev);
      setRevivalFund(newRev);

      showToast(`Revived ${symbol}! +${entryValue.toFixed(2)} USD`);
      utils.vibrate();
      Analytics.track('deposit', { symbol, value: entryValue });
    } else {
      showToast('Deposit failed. Try again.', 'error');
    }
  };

  const weeklyDraw = async () => {
    if (entries.length === 0) {
      showToast('No entries yet! Scan and revive first.', 'warning');
      return;
    }
    if (prizePool < 1) {
      showToast('Prize pool too small. Need more revivals!', 'warning');
      return;
    }

    Analytics.track('draw_attempt');
    const result = await BackendAPI.executeDraw();

    if (result && result.success) {
      const winner = result.winner;
      const payout = result.prizePool || prizePool;
      // Reset prizePool to 0 and clear entries (in production, award must be done by backend/contract)
      localStorage.setItem('mg_prizePool', '0');
      localStorage.setItem('mg_entries', JSON.stringify([]));
      setPrizePool(0);
      setEntries([]);
      localStorage.setItem('mg_lastWinner', JSON.stringify({ winner, amount: payout, ts: Date.now() }));

      showToast(`${winner.symbol} reviver wins ${utils.formatUSD(payout)}!`);
      utils.vibrate(300);
      Analytics.track('draw_completed', { winner: winner.symbol, amount: payout });
      // Note: ecosystem/developer/revival funds remain and should be available to responsible parties
      await loadGlobalStats();
    } else {
      showToast('Draw failed. Try again later.', 'error');
    }
  };

  const buryMeme = () => {
    if (!utils.isValidBSC(buryCA)) {
      showToast('Invalid BSC contract address!', 'error');
      return;
    }

    if (!connected) {
      showToast('Connect wallet to bury memes!', 'warning');
      return;
    }

    const symbol = 'DEAD';
    const epitaph = generateEpitaph(buryName);
    const grave = {
      ca: buryCA,
      n: buryName || 'Dead Meme',
      s: symbol,
      e: epitaph,
      t: Date.now(),
      u: utils.shortAddr(address)
    };

    const newBuried = [grave, ...buriedGraves];
    setBuriedGraves(newBuried);
    localStorage.setItem('mg_buriedGraves', JSON.stringify(newBuried));

    setBuryCA('');
    setBuryName('');
    setShowBuryForm(false);
    showToast(`Buried! "${epitaph}"`);
    utils.vibrate();
    Analytics.track('bury', { name: grave.n });
  };

  const shareGrave = async (symbol) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `I just revived ${symbol} on MemeGrave!`,
          text: 'Turn dead memes into lottery tickets 💀',
          url: window.location.href
        });
        showToast('+5 bonus entries for sharing!');
        Analytics.track('share', { symbol });
        // Add a bonus entry (frontend only)
        incrementBonusEntries(5);
      } catch (e) {
        console.log('Share cancelled');
      }
    }
  };

  const incrementBonusEntries = (n = 1) => {
    const fakeEntry = {
      token: 'BONUS',
      symbol: 'BONUS',
      user: address || 'anonymous',
      value: 0,
      ts: Date.now(),
      bonus: n
    };
    const newEntries = [...entries, fakeEntry];
    setEntries(newEntries);
    localStorage.setItem('mg_entries', JSON.stringify(newEntries));
    Analytics.track('bonus_entries', { n });
  };

  const installPWA = async () => {
    const success = await PWAInstaller.install();
    if (success) {
      showToast('App installed! Check your home screen.');
      setShowPWAPrompt(false);
    } else {
      showToast('Installation cancelled', 'warning');
    }
  };

  const handleSocialLogin = async (provider) => {
    // Mock login for now
    const user = SocialAuth.mockLogin(provider);
    setSocialUser(user);
    showToast(`Logged in as ${user.username}`);
  };

  // minimal UI render for debugging / staging
  return (
    <div className={`mem-grave ${theme}`}>
      <header>
        <h1>MemeGrave</h1>
        <div>
          <button onClick={toggleTheme}>Theme: {theme}</button>
          <button onClick={connectWallet}>{connected ? utils.shortAddr(address) : 'Connect Wallet'}</button>
        </div>
      </header>

      <main>
        <section>
          <h2>Global Pools</h2>
          <ul>
            <li>Prize Pool: {utils.formatUSD(prizePool)}</li>
            <li>Ecosystem Fund: {utils.formatUSD(ecosystemFund)}</li>
            <li>Developer Fund: {utils.formatUSD(developerFund)}</li>
            <li>Revival Fund: {utils.formatUSD(revivalFund)}</li>
            <li>Entries: {entries.length}</li>
          </ul>
          <button onClick={weeklyDraw} disabled={loading}>Run Weekly Draw (mock)</button>
        </section>

        <section>
          <h2>Scan Graveyard</h2>
          <button onClick={scanGraveyard} disabled={loading}>Scan</button>
          <div>
            {deadGraves.map((g, idx) => (
              <div key={idx} style={{ border: '1px solid #444', margin: 6, padding: 8 }}>
                <strong>{g.baseToken?.symbol || 'UNKNOWN'}</strong> - Liquidity: {utils.formatUSD(g.liquidity?.usd || 0)} - 1h volume: {utils.formatUSD(g.volume?.h1 || 0)}
                <div>
                  <button onClick={() => deposit(g.baseToken?.address || '0x0', g.baseToken?.symbol || 'UNK', Number(g.liquidity?.usd || 0))}>Revive (deposit mock)</button>
                  <button onClick={() => { setShowBuryForm(true); setBuryCA(g.baseToken?.address || ''); setBuryName(g.baseToken?.symbol || ''); }}>Bury</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Buried Graves</h2>
          {buriedGraves.map((b, i) => (
            <div key={i}>
              <strong>{b.n}</strong> — {b.e} <em>by {b.u}</em>
            </div>
          ))}
        </section>

        <section>
          <h2>Social</h2>
          <button onClick={() => handleSocialLogin('twitter')}>Mock Twitter Login</button>
          <button onClick={() => handleSocialLogin('discord')}>Mock Discord Login</button>
          <div>{socialUser ? `Logged in: ${socialUser.username}` : 'Not logged in'}</div>
        </section>
      </main>

      {showBuryForm && (
        <div className="modal">
          <h3>Bury Meme</h3>
          <label>Contract Address</label>
          <input value={buryCA} onChange={(e) => setBuryCA(e.target.value)} />
          <label>Name</label>
          <input value={buryName} onChange={(e) => setBuryName(e.target.value)} />
          <button onClick={buryMeme}>Confirm Bury</button>
          <button onClick={() => setShowBuryForm(false)}>Cancel</button>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}

      <footer>
        <small>Demo build — not for production funds</small>
      </footer>
    </div>
  );
}