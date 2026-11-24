# Voucher booking experience

**Slug**: `voucher-booking-experience`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-11-19T23:04:34.193Z`
**Linear**: PRD-1574 (protocol study: RESR-119)

## Problem

Booking one hub day for one voucher asks too much of both people. The member comes back five
times (Review and Redeem, Deposit, Start the Booking, Approve the Final Split, Confirm It Was
Kept), and the booking page runs to three phone screens and tells its status three times. The
steward acts three times, one of them through a Safe file, finds the same booking in two places,
and reads seven reserve facts.

## Desired Outcome

- A member books a service in three moments: Book, Deposit, Confirm Your Visit.
- A steward works every booking from one queue and reads a promise list with one row per promise.
- Both apps call the two kinds of promise Offer and Request.
- What should not change: what the contracts enforce (issuer approval before a deposit,
  acceptance after a confirmed deposit, the holder's approval before vouchers move), recovery from
  every failed or pending send, and the Earn and issuer pages.

## Scope Notes

- In scope: the App's booking page and sheets, the Hub's Promises tab, the steward's Accept and
  Start, one closing sheet, the wording sweep.
- Out of scope: contract changes (studied in RESR-119), the Earn page, the issuer's own-offer page,
  a bell notice for bookings.

## Success Signal

A hub day walked in Storybook from Book to Kept takes the member three acts and the steward two,
and every recovery state stays reachable.
