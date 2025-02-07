select
  funding.name,
  -(funding.embedding <#> query_embedding) as similarity
from funding
where funding.embedding <#> query_embedding < 1 - match_threshold
order by funding.embedding <#> query_embedding
limit match_count;
