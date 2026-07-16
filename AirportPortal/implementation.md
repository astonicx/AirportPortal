# Implementation Index (Current)

## Status
This file now points to the active V2 implementation markdown set.
Use these documents as the source of truth for execution order.

## Active Markdown Set
- Dev 1 plan: Dev1_implementation.md
- Dev 2 plan: Dev2_implementation.md
- Dev 3 plan: Dev3_implementation.md
- Master plan: MASTER_IMPLEMENTATION_V2.md
- Master tasks: MASTER_TASKS_V2.md

## Required Start Order
1. Dev 1 foundation gate
- T-1
- T-2
- T-3

2. Dev 2 and Dev 3 begin only after Dev 1 foundation gate clears.

3. Dev 3 booking and check-in work begins only after Dev 2 contract gates clear:
- Flights contract: T-10
- Booking contract: T-11, T-13, T-15
- Check-in contract: T-18, T-19

4. Attendant features begin only after:
- Dev 1 T-6
- Dev 2 T-21 (for frontend attendant list flows)

## Team Rule
Do not start a task if its dependency list is incomplete in the corresponding implementation markdown.
