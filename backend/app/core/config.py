from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Real-Time Chat App"
    api_v1_prefix: str = "/api/v1"

    postgres_user: str = "chat_user"
    postgres_password: str = "chat_password"
    postgres_db: str = "chat_db"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    redis_url: str = "redis://redis:6379/0"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"

    jwt_secret_key: str = "kX9!vQ2#tR7@pL4$zN8%wB3^mD6&yH1*eJ5(Us0)Gf9_Ac7-Vo2=Kr6+Ti4?Qp8~Lb3Cx1"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:"
            f"{self.postgres_password}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
