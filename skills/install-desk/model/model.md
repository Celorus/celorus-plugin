---
type: model
title: 'Celorus KF™ Core: the desk model'
shelf: open
model_version: 1
spine:
- not-yet-contacted
- in-contact
- proposing
- won
- parked-or-lost
every_page_must_have:
- type
- title
every_page_usual:
- description
- aliases
- sources
- timestamp
account_fields:
- stage
- relationship_kind
- owner
account_kinds:
- person
- family
- firm
system_types:
- desk
- desk-log
- motion-spec
- register
- marks
- queue
- board
- draft
- review
- context
- view
- rulebook
- own-words
- model
- model-kind
- model-list
- merge-record
- model-changes
pack_lists:
- stage
- relationship_kind
- role_in_deal
- segment
- band
- sent_kind
- learning_bucket
desk_lists:
- product
- territory
- team
field_lists:
- channel <- channel
- standing <- standing
- learning_status <- learning_status
- origin <- rule_origin
- stage <- stage
- relationship_kind <- relationship_kind
- role_in_deal <- role_in_deal
- sent_kind <- sent_kind
- bucket <- learning_bucket
- segments <- segment
- band <- band
---

# Celorus KF™ Core: the desk model

The Celorus Knowledge Framework™ (Celorus KF™), version 1: the kinds of things a sales desk knows. Every page names its kind in `type`. A person, a family or a firm becomes an account when it carries all three of `stage`, `relationship_kind` and `owner`, and the page never moves. Every stage word sits on one of five steps: not-yet-contacted, in-contact, proposing, won, parked-or-lost.

`sources`, where a page carries it, is a list of entries that each name a `resource`, as the Open Knowledge Format writes it.

A client may add their own words to a pack list, each matched to one of ours, and their own extra details on any page, on the desk's own-words page. Never a new kind of thing and never a new kind of connection.
