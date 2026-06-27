# 🚦 Rate Limiting Architecture

This document explains the rate limiting design for the Hermes API workspace, specifically detailing why the **Token Bucket** algorithm was selected over the **Leaky Bucket** algorithm for endpoints like `/check-username`.

---

## 🔍 The Contenders

When implementing rate limits to protect endpoints (like onboarding username checks), two classic algorithms are typically considered:

### 🪙 1. Token Bucket
A bucket is initialized with a maximum capacity of tokens (`capacity`).
* Tokens are added to the bucket at a constant rate (`refillRate`).
* Each API request consumes one token.
* If no tokens are left, requests are rejected (`429 Too Many Requests`).
* **Key Characteristic:** Allows for **bursts** of traffic up to the bucket's capacity.

### 🚰 2. Leaky Bucket
A bucket holds requests (acting as a queue) instead of tokens, and "leaks" them out at a constant, steady rate to be processed.
* If a burst of requests arrives, they are queued.
* If the queue overflows, additional requests are immediately dropped.
* **Key Characteristic:** Enforces a **strict, flat execution rate** and completely smooths out traffic peaks.

---

## 🆚 Comparison Table

| Metric | 🪙 Token Bucket (Selected) | 🚰 Leaky Bucket |
| :--- | :--- | :--- |
| **Burst Traffic** | **Allowed** (up to capacity) | **Smooths it out** (forces delay / queues) |
| **Request Latency** | **Instant response** for bursts | **High latency** (requests wait in the queue) |
| **Use Case Fit** | Intermittent, quick interactive user tasks | Batch processing, egress traffic limiting |
| **Complexity** | Low (simple in-memory timestamps) | Higher (requires queue management & worker intervals) |

---

## 🎯 Why Token Bucket was chosen for Onboarding Username Checks

### 1. The Human Typing Factor (Supporting Bursts)
When a user is choosing a username during onboarding:
* They type rapidly, pause, edit, and type again. 
* A debounce function on the frontend (e.g., 300ms) groups keypresses, but a user typing or correcting their input quickly will still trigger multiple queries (bursts) in a 2-second window.
* **Token Bucket** easily handles these bursts because the user can consume available tokens instantly.
* **Leaky Bucket** would queue or delay these check requests, making the UI feel sluggish and unresponsive to the user.

### 2. Low Latency User Experience
* With a **Leaky Bucket**, if the user hits the limit, their requests are held in a queue and processed slowly. The user is left waiting with a loading spinner while the queue "leaks" their request.
* With a **Token Bucket**, the server processes requests instantly if a token is available, and returns an immediate `429` status if not, allowing the frontend to show a clear "Please slow down" message without lagging.

### 3. Protection against Brute-Forcing
* Although it allows short bursts, the **Token Bucket** has a strict, slow refill rate (e.g., 1 token per second). If a bot tries to brute-force usernames programmatically, it will exhaust the bucket instantly and be blocked by the constant refill rate limit.

---

## 🛠️ Configuration Settings

For the `onboarding/check-username` endpoint, the following values have been configured:

* **Bucket Capacity (`5`):** Allows a user to perform up to 5 checks in immediate succession (e.g. typing a short name quickly).
* **Refill Rate (`1 token per second`):** Once exhausted, the user gains the ability to check one name every second.
* **Memory Cleanup Interval (`10 minutes`):** Automatically sweeps inactive IP buckets from memory to keep the server RAM footprint tiny and prevent memory leaks.
