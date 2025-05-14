create or replace view get_deals_with_stats as
select
  d.*,
  p.id as profile_id,
  p.email,
  p.display_name,
  coalesce(sum(case when dv.vote_type then 1 else -1 end), 0) as popularity,
  count(case when dv.vote_type then 1 end) as positive_votes,
  count(distinct dc.id) as comment_count
from deals d
left join profiles p on p.id = d.user_id
left join deal_votes dv on dv.deal_id = d.id
left join deal_comments dc on dc.deal_id = d.id
group by d.id, p.id, p.email, p.display_name;