# Card art — drop your PNGs here

The game renders these files **verbatim** (no recolouring, no borders added).

**Naming:** `<rank><suit>.png`
- rank: `A 2 3 4 5 6 7 8 9 10 J Q K` (ten is `10`)
- suit: `c` clubs · `d` diamonds · `h` hearts · `s` spades (lowercase)
- the back is `back.png`

So the full set (53 files):

```
Ac  2c  3c  4c  5c  6c  7c  8c  9c  10c  Jc  Qc  Kc
Ad  2d  3d  4d  5d  6d  7d  8d  9d  10d  Jd  Qd  Kd
Ah  2h  3h  4h  5h  6h  7h  8h  9h  10h  Jh  Qh  Kh
As  2s  3s  4s  5s  6s  7s  8s  9s  10s  Js  Qs  Ks
back
```

(All `.png`.) Any card whose PNG is missing falls back to a built-in vector card.

The full 52-card deck + back is present. To update a card, just overwrite its
`<rank><suit>.png` here (hard-refresh the browser to bust the image cache).

Tip: keep a consistent aspect ratio across files (~5:7) so they line up.
