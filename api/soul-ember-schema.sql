CREATE TABLE IF NOT EXISTS soul_runs (
 nonce uuid PRIMARY KEY,
 challenge text NOT NULL,
 hero text NOT NULL,
 duration integer NOT NULL CHECK(duration > 0),
 kills integer NOT NULL CHECK(kills >= 0),
 gold integer NOT NULL CHECK(gold >= 0),
 score integer NOT NULL CHECK(score >= 0),
 victory boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS soul_rankings ON soul_runs(challenge,score DESC,created_at);
CREATE TABLE IF NOT EXISTS soul_budgets(bucket bigint PRIMARY KEY,total integer NOT NULL);
CREATE TABLE IF NOT EXISTS soul_metrics(day date NOT NULL,event text NOT NULL,total bigint NOT NULL,PRIMARY KEY(day,event));
