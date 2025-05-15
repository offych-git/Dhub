create or replace view get_deals_with_stats as
with vote_stats as (
  select
    deal_id,
    sum(case when vote_type then 1 else -1 end) as popularity
  from deal_votes
  group by deal_id
),
comment_stats as (
  select
    deal_id,
    count(*) as comment_count
  from deal_comments
  group by deal_id
)
select
  d.*,
  p.id as profile_id,
  p.email,
  p.display_name,
  coalesce(v.popularity, 0) as popularity,
  coalesce(c.comment_count, 0) as comment_count
from deals d
left join profiles p on p.id = d.user_id
left join vote_stats v on v.deal_id = d.id
left join comment_stats c on c.deal_id = d.id;
