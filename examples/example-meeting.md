---
title: Weekly Group Meeting
date: 2026-10-07
presenter: Han Nay Aung
attendees: [Han Nay Aung, Li Wei, Omar, Priya, Dr. Keller]
project: Robust Image Classifiers
location: Room 3.14 / Zoom
presenters: [Han Nay Aung, Li Wei, Omar, Priya]
---

## Agenda

1. Updates since last week
2. New results on data augmentation
3. Open questions
4. Action items

---

## Updates since last week

- Finished the baseline runs on all **five** datasets
- Cleaned up the training code and pushed it to the lab repo
- @Omar shared the new compute schedule

> [!NOTE]
> The cluster is down for maintenance on Friday, so please queue jobs before Thursday night.

---

## The model

We minimize the usual cross-entropy loss with a small penalty on the weights:

$$
\mathcal{L}(\theta) = -\frac{1}{N}\sum_{i=1}^{N} \log p_\theta(y_i \mid x_i) + \lambda \lVert \theta \rVert_2^2
$$

Inline math works too: with $\lambda = 10^{-4}$ and learning rate $\eta = 0.01$, training is stable.[^1]

---

## New results

![Accuracy by method](data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0MjAnIGhlaWdodD0nMjAwJyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPScxMyc+PHJlY3Qgd2lkdGg9JzQyMCcgaGVpZ2h0PScyMDAnIGZpbGw9J3doaXRlJy8+PGxpbmUgeDE9JzQwJyB5MT0nMTcwJyB4Mj0nNDAwJyB5Mj0nMTcwJyBzdHJva2U9JyM5OTknLz48cmVjdCB4PSc3MCcgeT0nNzAnIHdpZHRoPSc3MCcgaGVpZ2h0PScxMDAnIGZpbGw9JyM5NGEzYjgnLz48cmVjdCB4PScxNzUnIHk9JzUyJyB3aWR0aD0nNzAnIGhlaWdodD0nMTE4JyBmaWxsPScjNjBhNWZhJy8+PHJlY3QgeD0nMjgwJyB5PSczMCcgd2lkdGg9JzcwJyBoZWlnaHQ9JzE0MCcgZmlsbD0nIzE0YjhhNicvPjx0ZXh0IHg9JzEwNScgeT0nMTkwJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJz5CYXNlbGluZTwvdGV4dD48dGV4dCB4PScyMTAnIHk9JzE5MCcgdGV4dC1hbmNob3I9J21pZGRsZSc+KyBGbGlwPC90ZXh0Pjx0ZXh0IHg9JzMxNScgeT0nMTkwJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJz4rIE1peDwvdGV4dD48dGV4dCB4PScxMDUnIHk9JzYyJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJz44MS4yPC90ZXh0Pjx0ZXh0IHg9JzIxMCcgeT0nNDQnIHRleHQtYW5jaG9yPSdtaWRkbGUnPjg0LjA8L3RleHQ+PHRleHQgeD0nMzE1JyB5PScyMicgdGV4dC1hbmNob3I9J21pZGRsZSc+ODcuNTwvdGV4dD48L3N2Zz4=)

Table: Test accuracy (%) on each dataset. Best result in **bold**.

| Method     | CIFAR-10 | SVHN | STL-10 |
|------------|---------:|-----:|-------:|
| Baseline   | 81.2     | 90.4 | 70.1   |
| + Flip     | 84.0     | 91.0 | 72.8   |
| + Mix      | **87.5** | **92.3** | **75.6** |

> [!RESULT] Mixing helps on every dataset
> The gain is largest on STL-10 (+5.5 points), where we have the least training data.

---

## Open questions

> [!QUESTION]
> Does the gain hold with a larger model, or is it mostly a small-data effect?

> [!IDEA]
> Try the same augmentation on the medical-imaging set from Priya's project.

> [!DECISION]
> We will use **+ Mix** as the new default for all experiments.

---

## Action items

- [ ] Run the larger model with + Mix — @Han
- [ ] Prepare the medical-imaging data split — @Priya
- [ ] Check the evaluation script for the SVHN bug — @Li
- [x] Update the compute schedule — @Omar

[^1]: We tried $\eta = 0.1$ first, but the loss diverged after about 200 steps.
