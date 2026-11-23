# The World in One Day — Sunday, 22 November 2026

[![make.fun bounty](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/Yadidefo61/news-image-20261122/rank.svg)](https://make.fun/bounty/news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/Yadidefo61/news-image-20261122/reward.svg)](https://make.fun/bounty/news-image-20261122)

One image that sums up the world news of **Sunday, 22 November 2026** — drawn as a
newspaper front page, in code.

Bounty: https://make.fun/bounty/news-image-20261122

## The image

`main.ts` (Node 22, standard library only, no network) draws a single deterministic
1024×1024 PNG, `entry.png`, styled as a front page of **THE WORLD IN ONE DAY**,
dated **SUNDAY, 22 NOVEMBER 2026**. Every illustration is drawn by the program
itself — no downloaded images, no photographs.

Six real stories from the day:

1. **COP31 collapses** — the UN climate talks in Antalya, Turkey, end with no deal
   after the EU and others reject a final text that never mentions fossil fuels.
   The longest climate summit on record.
2. **Russian drone hits an apartment block near Kyiv** — part of a five-storey
   building collapses on Sunday morning; at least 14 people missing.
3. **Iran strike hits Bahrain** — an attack on a civilian industrial site in Sitra
   injures two people; Saudi Arabia, Kuwait and Qatar condemn it.
4. **Factory fire in Indonesia** — a blaze at a candy factory in Cikande, Banten,
   kills 3 workers; 36 remain missing as rescuers search the ruins.
5. **South Korea's education minister resigns** — Choi Kyo-jin steps down on Sunday,
   days before the college entrance exams, over an AI cheating scandal.
6. **FBI probes a hack of the national crime database** — an apparent breach of the
   NCIC system used for warrants, fugitives and criminal-history checks.

Sources: CNN, AP, Reuters, AFP, The Times, The Wall Street Journal — all reporting
events of 22 November 2026.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024, under 1 MiB). The program is fully
deterministic — fixed seed, no clock, no randomness — so two runs produce
byte-identical PNGs.

## License

MIT — see [LICENSE](LICENSE).
