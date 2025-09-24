#pragma once

#include <sw/redis++/redis++.h>

#include <atomic>
#include <chrono>
#include <string>
#include <thread>
#include <utility>

class RedisLease
{
public:
  RedisLease(sw::redis::Redis &redis, std::string key,
             std::chrono::seconds ttl)
      : redis_(redis), key_(std::move(key)), ttl_(ttl)
  {
    if (ttl_ <= std::chrono::seconds::zero())
    {
      ttl_ = std::chrono::seconds(1);
    }
    acquired_ = redis_.set(key_, "1", ttl_, sw::redis::UpdateType::NOT_EXIST);
    if (acquired_)
    {
      running_.store(true);
      refresher_ = std::thread([this]
                               { this->refresh_loop(); });
    }
  }

  RedisLease(const RedisLease &) = delete;
  RedisLease &operator=(const RedisLease &) = delete;

  RedisLease(RedisLease &&) = delete;
  RedisLease &operator=(RedisLease &&) = delete;

  ~RedisLease()
  {
    release();
  }

  bool acquired() const { return acquired_; }

  void release()
  {
    if (!acquired_)
    {
      return;
    }

    running_.store(false);
    if (refresher_.joinable())
    {
      refresher_.join();
    }

    try
    {
      redis_.del(key_);
    }
    catch (...)
    {
    }
    acquired_ = false;
  }

private:
  void refresh_loop()
  {
    auto interval = ttl_ / 2;
    if (interval <= std::chrono::seconds::zero())
    {
      interval = std::chrono::seconds(1);
    }

    while (running_.load())
    {
      std::this_thread::sleep_for(interval);
      if (!running_.load())
      {
        break;
      }
      try
      {
        redis_.expire(key_, ttl_);
      }
      catch (...)
      {
      }
    }
  }

  sw::redis::Redis &redis_;
  std::string key_;
  std::chrono::seconds ttl_;
  bool acquired_{false};
  std::atomic<bool> running_{false};
  std::thread refresher_;
};
