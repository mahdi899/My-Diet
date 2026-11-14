-- Up Migration
create table user_personal_details (
  user_id uuid primary key references users(id) on delete cascade,
  details_encrypted text not null
);

-- Down Migration
drop table user_personal_details;
