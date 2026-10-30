CREATE FUNCTION propose_character_import(cid uuid,did uuid,sid uuid,tid uuid,base integer,patch jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := nullif(current_setting('app.user_id',true),'')::uuid; pid uuid := gen_random_uuid(); eid uuid := gen_random_uuid();
BEGIN
 IF aar_role(cid) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM documents WHERE id=did AND campaign_id=cid AND (submitted_by=uid OR aar_role(cid)='DM')) THEN RAISE EXCEPTION 'Source not authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sessions WHERE id=sid AND campaign_id=cid) THEN RAISE EXCEPTION 'Session not found'; END IF;
 IF tid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM characters WHERE id=tid AND campaign_id=cid AND (owner_id=uid OR aar_role(cid)='DM')) THEN RAISE EXCEPTION 'Character not authorized'; END IF;
 IF jsonb_typeof(patch->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(patch->'fields') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid import patch'; END IF;
 INSERT INTO evidence(id,campaign_id,session_id,visibility,speaker,content,source) VALUES(eid,cid,sid,'PARTY','Reviewed sheet import','Source PDF '||did::text||'; voluntarily shared reviewed fields: '||patch::text,'CHARACTER_IMPORT');
 INSERT INTO proposals(id,campaign_id,session_id,target_kind,target_id,submitted_by,submitted_by_type,visibility,patch,reason,evidence_ids,base_revision) VALUES(pid,cid,sid,'IMPORT',tid,uid,CASE WHEN aar_role(cid)='DM' THEN 'DM' ELSE 'PLAYER' END,'PARTY',patch,'Reviewed PDF fields; source snapshot retained. Reconciliation requires DM approval.',jsonb_build_array(eid),base);
 RETURN pid;
END $$;
