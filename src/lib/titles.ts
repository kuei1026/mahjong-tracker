export function generateTitles(stats: any[]) {
  if (stats.length === 0) return {};

  const titles: Record<string, string> = {};

  const maxTsumo = [...stats].sort((a, b) => b.tsumoCount - a.tsumoCount)[0];
  const maxDealIn = [...stats].sort((a, b) => b.dealInCount - a.dealInCount)[0];
  const maxAvgTai = [...stats].sort((a, b) => b.avgTai - a.avgTai)[0];
  const minDealIn = [...stats].sort((a, b) => a.dealInCount - b.dealInCount)[0];

  if (maxTsumo.tsumoCount > 0) {
    titles[maxTsumo.playerName] = '🟢 自摸之神';
  }

  if (maxDealIn.dealInCount > 0) {
    titles[maxDealIn.playerName] = '🔴 放槍王';
  }

  if (maxAvgTai.avgTai > 0) {
    titles[maxAvgTai.playerName] = '💰 高台王';
  }

  if (minDealIn.dealInCount === 0) {
    titles[minDealIn.playerName] = '🎯 最穩玩家';
  }

  return titles;
}