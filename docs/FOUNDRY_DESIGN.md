# Foundry adapter: deferred design

No module or hook compatibility is claimed. Select and verify a supported Foundry release before implementing.

Planned envelope: provider, connectionId, worldId, campaignId, sessionId, eventId, sourceTimestamp, receivedTimestamp, actorId/characterId/sceneId, type, payload, visibility, permissions, schemaVersion, signature. Per-campaign credentials, HMAC validation, inbox uniqueness on connection/event, opt-in scopes and persisted client outbox replay are required. Map user-verified actor IDs; timestamps alone never establish causality. VTT events may only auto-commit separately enabled action types without conflicts.

Start with documented chat, actor, combat hooks and a permission-scoped event subset after checking current official documentation. Screenshot capture must use the authorized rendered client view, never hidden GM layers/fog bypasses; automatic player capture stays off until privacy can be verified in the actual target version. Roll20 transport/screenshot feasibility remains unverified.
