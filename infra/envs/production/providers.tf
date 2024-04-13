
provider "aws" {
  region = "ap-northeast-1"
  #  profile = "shunbun-production-admin-role"

  default_tags {
    tags = {
      Product     = "shunbun"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}
