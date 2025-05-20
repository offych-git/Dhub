create or replace view get_promos_with_stats as
with vote_stats as (
  select
    promo_id,
    sum(case when vote_type then 1 else -1 end) as popularity
  from promo_votes
  group by promo_id
),
comment_stats as (
  select
    promo_id,
    count(*) as comment_count
  from promo_comments
  group by promo_id
)
select
  promo.*,
  p.id as profile_id,
  p.email,
  p.display_name,
  coalesce(v.popularity, 0) as popularity,
  coalesce(c.comment_count, 0) as comment_count
from promo_codes promo
left join profiles p on p.id = promo.user_id
left join vote_stats v on v.promo_id = promo.id
left join comment_stats c on c.promo_id = promo.id;
