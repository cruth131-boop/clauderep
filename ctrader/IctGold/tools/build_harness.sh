#!/usr/bin/env bash
# Builds the offline harness twice: out/new = current bot sources (bot/), out/base = the unchanged v2.59 upload
# restored from git (commit that added the baseline), for the OFF-equivalence test.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
base_commit="${BASE_COMMIT:-$(git -C "$here" log --format=%H --diff-filter=A -- bot/IctGoldV259Dev.cs | tail -1)}"
base_src="$here/harness/out/baseline-src"
rm -rf "$base_src" && mkdir -p "$base_src"
for f in IctGoldV259Dev.cs Ns.cs NsRules.cs FailSafe.cs FailSafeBot.cs; do
  git -C "$here" show "$base_commit:ctrader/IctGold/bot/$f" > "$base_src/$f"
done
cd "$here/harness"
dotnet build -c Release -o out/new
dotnet build -c Release -p:BotDir="$base_src" -p:IntermediateOutputPath=obj/base/ -o out/base
echo "built out/new (bot/) and out/base (v2.59 @ ${base_commit:0:7})"
