# Part 1: Google Ads Domain Guide

Welcome to the Google Ads domain! To understand why our tool exists and how it works, you need to understand how advertising on Google Search operates.

---

## 1. Keywords vs. Search Terms

A common point of confusion for beginners is the difference between a **Keyword** and a **Search Term** (or Search Query):

* **Search Term (Search Query)**: The exact word or phrase that a real user types into the Google search box (e.g., *"how much does a dental filling cost in manchester"*).
* **Keyword**: A word or phrase that an advertiser (like SearchSavior's client) bids on in their Google Ads account to trigger their ads (e.g., *"dental filling"*).

Google Ads uses matching algorithms to connect a user's **Search Term** to an advertiser's **Keyword**.

---

## 2. Google Ads Match Types

When you add a keyword to your account, you assign it a **Match Type**. This tells Google how closely the user's search query must match your keyword before your ad is shown.

There are three primary match types:

### A. Broad Match
* **Syntax**: `keyword` (no punctuation, e.g., `dentist`)
* **How it works**: Google shows your ad for searches related to your keyword. This includes synonyms, misspelling, related searches, and other relevant variations.
* **Pros**: Attracts a high volume of traffic and discovers new search patterns.
* **Cons**: Tends to trigger ads on irrelevant queries (e.g., bidding on `dentist` might trigger your ad for `"how to become a dentist"` or `"dental nurse salaries"`).

### B. Phrase Match
* **Syntax**: `"keyword"` (surrounded by quotes, e.g., `"dental clinic"`)
* **How it works**: Google shows your ad for queries that include the meaning of your keyword. It matches searches that contain the phrase or close variations, with words added before or after.
* **Pros**: Reaches a good balance between volume and relevance.
* **Cons**: Flipped word orders or synonyms can still slip through or be blocked depending on Google's semantic matching.

### C. Exact Match
* **Syntax**: `[keyword]` (surrounded by square brackets, e.g., `[emergency dentist]`)
* **How it works**: Google shows your ad only for searches that have the exact same meaning or intent as your keyword.
* **Pros**: Maximum relevance; highly targeted.
* **Cons**: Very low traffic volume.

---

## 3. Negative Keywords

**Negative Keywords** are the most powerful tool for controlling waste in Google Ads. They do the exact opposite of regular keywords: they tell Google **not** to show your ad if a search query contains that word or phrase.

If you add `"jobs"` as a campaign-level negative keyword:
* Search query `"dentist jobs in London"` $\rightarrow$ **Blocked** (ad is not shown).
* Search query `"family dentist in London"` $\rightarrow$ **Allowed** (ad is shown).

### Negative Match Types
Just like positive keywords, negative keywords have match types:
* **Negative Broad**: Blocks your ad if the search query contains all negative keyword terms, regardless of order. (e.g. negative broad `free dentist` blocks `"dentist London free"`, but not `"dentist London"`).
* **Negative Phrase**: Blocks your ad if the search query contains the negative keyword phrase in the exact order. (e.g. negative phrase `"free dentist"` blocks `"need a free dentist London"`, but does not block `"dentist is free"`).
* **Negative Exact**: Blocks your ad only if the search query matches the negative keyword exactly, letter-for-letter. (e.g. negative exact `[free dentist]` blocks `"free dentist"`, but does not block `"free dentist London"`).

---

## 4. Smart Bidding & Automated Bidding

Modern Google Ads campaigns rely heavily on **Smart Bidding**. Instead of manually deciding how much to pay for a click (CPC), advertisers tell Google their overall business target, and Google's machine learning algorithms bid automatically:

* **Target CPA (Cost-Per-Acquisition)**: Google adjusts bids to get as many conversions (leads/sales) as possible at your set target cost per lead.
* **Maximize Conversions**: Google bids aggressively to spend your daily budget while capturing the highest possible number of conversions, regardless of CPA.

Smart Bidding algorithms learn from historical data. If a particular type of search query converts well, Google will bid higher on it. If it doesn't convert, Google should theoretically bid less. 

*However, when Google's automated matching gets too aggressive, it introduces a major performance issue known as the **AI Max matching hangover**—which is the problem we are here to solve.*
