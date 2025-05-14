drop function update_item_status;

create or replace function update_item_status(p_item_id uuid, p_status text, p_table_name text) returns boolean
    security definer
    language plpgsql
as
$$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_is_moderator boolean;
  v_result boolean;
BEGIN
  -- Get current user's role
  SELECT
    id,
    is_admin,
    role = 'moderator' INTO v_user_id, v_is_admin, v_is_moderator
  FROM profiles
  WHERE id = auth.uid();

  -- Check if user has permission
  IF NOT (v_is_admin OR v_is_moderator) THEN
    RAISE EXCEPTION 'User does not have permission to update status';
  END IF;

  -- Update the item status
  EXECUTE format(
    'UPDATE %I SET
      status = $1,
      moderator_id = $2,
      moderated_at = now(),
      updated_at = now()
    WHERE id = $3
    RETURNING true',
    p_table_name
  ) INTO v_result
  USING p_status, auth.uid(), p_item_id;

  RETURN v_result;
END;
$$;

alter function update_item_status(uuid, text, text) owner to postgres;

grant execute on function update_item_status(uuid, text, text) to anon;

grant execute on function update_item_status(uuid, text, text) to authenticated;

grant execute on function update_item_status(uuid, text, text) to service_role;