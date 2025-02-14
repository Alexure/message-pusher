import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Label, Modal, Pagination, Table } from 'semantic-ui-react';
import { API, openPage, showError, showSuccess, showWarning, timestamp2string } from '../helpers';

import { ITEMS_PER_PAGE } from '../constants';

function renderChannel(channel) {
  switch (channel) {
    case 'email':
      return <Label color='green'>邮件</Label>;
    case 'test':
      return (
        <Label style={{ backgroundColor: '#2cbb00', color: 'white' }}>
          微信测试号
        </Label>
      );
    case 'corp_app':
      return (
        <Label style={{ backgroundColor: '#5fc9ec', color: 'white' }}>
          企业微信应用号
        </Label>
      );
    case 'corp':
      return (
        <Label style={{ backgroundColor: '#019d82', color: 'white' }}>
          企业微信群机器人
        </Label>
      );
    case 'lark':
      return (
        <Label style={{ backgroundColor: '#00d6b9', color: 'white' }}>
          飞书群机器人
        </Label>
      );
    case 'ding':
      return (
        <Label style={{ backgroundColor: '#007fff', color: 'white' }}>
          钉钉群机器人
        </Label>
      );
    case 'bark':
      return (
        <Label style={{ backgroundColor: '#ff3b30', color: 'white' }}>
          Bark App
        </Label>
      );
    case 'client':
      return (
        <Label style={{ backgroundColor: '#121212', color: 'white' }}>
          WebSocket 客户端
        </Label>
      );
    case 'telegram':
      return (
        <Label style={{ backgroundColor: '#29a9ea', color: 'white' }}>
          Telegram 机器人
        </Label>
      );
    case 'discord':
      return (
        <Label style={{ backgroundColor: '#404eed', color: 'white' }}>
          Discord 群机器人
        </Label>
      );
    case 'none':
      return <Label>无</Label>;
    default:
      return <Label color='grey'>未知通道</Label>;
  }
}

function renderTimestamp(timestamp) {
  return (
    <>
      {timestamp2string(timestamp)}
    </>
  );
}

function renderStatus(status) {
  switch (status) {
    case 1:
      return (
        <Label basic color='olive'>
          投递中...
        </Label>
      );
    case 2:
      return (
        <Label basic color='green'>
          发送成功
        </Label>
      );
    case 3:
      return (
        <Label basic color='red'>
          发送失败
        </Label>
      );
    default:
      return (
        <Label basic color='grey'>
          未知状态
        </Label>
      );
  }
}

const MessagesTable = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(10);
  const autoRefreshSecondsRef = useRef(autoRefreshSeconds);
  const [activePage, setActivePage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState({
    title: '消息标题',
    description: '消息描述',
    content: '消息内容',
    link: ''
  });  // Message to be viewed
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const loadMessages = async (startIdx) => {
    setLoading(true);
    const res = await API.get(`/api/message/?p=${startIdx}`);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setMessages(data);
      } else {
        let newMessages = messages;
        newMessages.push(...data);
        setMessages(newMessages);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const onPaginationChange = (e, { activePage }) => {
    (async () => {
      if (activePage === Math.ceil(messages.length / ITEMS_PER_PAGE) + 1) {
        // In this case we have to load more data and then append them.
        await loadMessages(activePage - 1);
      }
      setActivePage(activePage);
    })();
  };

  const checkPermission = async () => {
    // Check global permission
    let res = await API.get('/api/status');
    const { success, data } = res.data;
    if (success) {
      if (data.message_persistence) {
        return;
      }
    }
    // Check user permission
    {
      let res = await API.get('/api/user/self');
      const { success, message, data } = res.data;
      if (success) {
        if (data.save_message_to_database !== 1) {
          showWarning('您没有消息持久化的权限，消息未保存，请联系管理员。');
        }
      } else {
        showError(message);
      }
    }
  };

  useEffect(() => {
    loadMessages(0)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    checkPermission().then();
  }, []);

  const viewMessage = async (id) => {
    setLoading(true);
    const res = await API.get(`/api/message/${id}`);
    const { success, message, data } = res.data;
    if (success) {
      setMessage(data);
      setViewModalOpen(true);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const resendMessage = async (id) => {
    setLoading(true);
    const res = await API.post(`/api/message/resend/${id}`);
    const { success, message } = res.data;
    if (success) {
      showSuccess('消息已重新发送！');
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const deleteMessage = async (id, idx) => {
    setLoading(true);
    const res = await API.delete(`/api/message/${id}`);
    const { success, message } = res.data;
    if (success) {
      showSuccess('操作成功完成！');
      let newMessages = [...messages];
      let realIdx = (activePage - 1) * ITEMS_PER_PAGE + idx;
      newMessages[realIdx].deleted = true;
      setMessages(newMessages);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const searchMessages = async () => {
    if (searchKeyword === '') {
      // if keyword is blank, load files instead.
      await loadMessages(0);
      setActivePage(1);
      return;
    }
    setSearching(true);
    const res = await API.get(`/api/message/search?keyword=${searchKeyword}`);
    const { success, message, data } = res.data;
    if (success) {
      setMessages(data);
      setActivePage(1);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleKeywordChange = async (e, { value }) => {
    setSearchKeyword(value.trim());
  };

  const sortMessage = (key) => {
    if (messages.length === 0) return;
    setLoading(true);
    let sortedMessages = [...messages];
    sortedMessages.sort((a, b) => {
      return ('' + a[key]).localeCompare(b[key]);
    });
    if (sortedMessages[0].id === messages[0].id) {
      sortedMessages.reverse();
    }
    setMessages(sortedMessages);
    setLoading(false);
  };

  const refresh = async () => {
    await loadMessages(0);
    setActivePage(1);
  };

  useEffect(() => {
    let intervalId;

    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (autoRefreshSecondsRef.current === 0) {
          refresh().then();
          setAutoRefreshSeconds(10);
          autoRefreshSecondsRef.current = 10;
        } else {
          autoRefreshSecondsRef.current -= 1;
          setAutoRefreshSeconds(autoRefreshSeconds => autoRefreshSeconds - 1); // Important!
        }
      }, 1000);
    }

    return () => clearInterval(intervalId);
  }, [autoRefresh]);


  return (
    <>
      <Form onSubmit={searchMessages}>
        <Form.Input
          icon='search'
          fluid
          iconPosition='left'
          placeholder='搜索消息的 ID，标题，描述，以及消息内容 ...'
          value={searchKeyword}
          loading={searching}
          onChange={handleKeywordChange}
        />
      </Form>
      <Table basic loading={loading}>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortMessage('id');
              }}
            >
              消息 ID
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortMessage('title');
              }}
            >
              标题
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortMessage('channel');
              }}
            >
              通道
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortMessage('timestamp');
              }}
            >
              发送时间
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortMessage('status');
              }}
            >
              状态
            </Table.HeaderCell>
            <Table.HeaderCell>操作</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {messages
            .slice(
              (activePage - 1) * ITEMS_PER_PAGE,
              activePage * ITEMS_PER_PAGE
            )
            .map((message, idx) => {
              if (message.deleted) return <></>;
              return (
                <Table.Row key={message.id}>
                  <Table.Cell>{'#' + message.id}</Table.Cell>
                  <Table.Cell>
                    {message.title ? message.title : '无标题'}
                  </Table.Cell>
                  <Table.Cell>{renderChannel(message.channel)}</Table.Cell>
                  <Table.Cell>{renderTimestamp(message.timestamp)}</Table.Cell>
                  <Table.Cell>{renderStatus(message.status)}</Table.Cell>
                  <Table.Cell>
                    <div>
                      <Button
                        size={'small'}
                        positive
                        loading={loading}
                        onClick={() => {
                          viewMessage(message.id).then();
                        }}
                      >
                        查看
                      </Button>
                      <Button
                        size={'small'}
                        color={'yellow'}
                        loading={loading}
                        onClick={() => {
                          resendMessage(message.id).then();
                        }}
                      >
                        重发
                      </Button>
                      <Button
                        size={'small'}
                        negative
                        loading={loading}
                        onClick={() => {
                          deleteMessage(message.id, idx).then();
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
        </Table.Body>

        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan='6'>
              <Button size='small' loading={loading} onClick={() => {
                refresh().then();
              }}>
                手动刷新
              </Button>
              <Button size='small' loading={loading} onClick={() => {
                setAutoRefresh(!autoRefresh);
                setAutoRefreshSeconds(10);
              }}>
                {autoRefresh ? `自动刷新中（${autoRefreshSeconds} 秒后刷新）` : '自动刷新'}
              </Button>
              <Pagination
                floated='right'
                activePage={activePage}
                onPageChange={onPaginationChange}
                size='small'
                siblingRange={1}
                totalPages={
                  Math.ceil(messages.length / ITEMS_PER_PAGE) +
                  (messages.length % ITEMS_PER_PAGE === 0 ? 1 : 0)
                }
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
      <Modal
        size='tiny'
        open={viewModalOpen}
      >
        <Modal.Header>{message.title ? message.title : '无标题'}</Modal.Header>
        <Modal.Content>
          {message.description ? <p className={'quote'}>{message.description}</p> : ''}
          {message.content ? <p>{message.content}</p> : ''}
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={() => {
            if (message.URL) {
              openPage(message.URL);
            } else {
              openPage(`/message/${message.link}`);
            }
          }}>
            打开
          </Button>
          <Button onClick={() => {
            setViewModalOpen(false);
          }}>
            关闭
          </Button>
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default MessagesTable;
